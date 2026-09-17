// Server-only Google OAuth helpers.
//
// Tokens never leave this process: no database columns, no logs,
// no API responses. The live session lives in module memory, which is
// correct for local single-user development and will be replaced by
// durable session storage before anything multi-user ships.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
  scope: string | null;
};

export type LiveSession = {
  email: string;
  tokens: TokenSet;
};

let liveSession: LiveSession | null = null;

export function getLiveSession(): LiveSession | null {
  return liveSession;
}

export function clearLiveSession(): void {
  liveSession = null;
}

export function storeLiveSession(
  email: string,
  tokens: TokenSet,
): LiveSession {
  liveSession = { email, tokens };
  return liveSession;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured. See .env.`);
  }
  return value;
}

export function getOAuthConfig() {
  return {
    clientId: requiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requiredEnv("GOOGLE_REDIRECT_URI"),
  };
}

export class OAuthExchangeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenSet> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new OAuthExchangeError(
      data.error ?? `http_${res.status}`,
      data.error_description ??
        "Token exchange failed. Authorization codes are single-use — restart the login flow for a fresh code.",
    );
  }
  return {
    accessToken: data.access_token,
    // Google sends refresh_token on first consent (our connect URL forces
    // prompt=consent + offline access, so it arrives every login here).
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope ?? null,
  };
}

export async function fetchGmailProfile(
  accessToken: string,
): Promise<{ email: string }> {
  const res = await fetch(GMAIL_PROFILE_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Gmail profile request failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { emailAddress?: string };
  if (!data.emailAddress) {
    throw new Error("Gmail profile returned no email address.");
  }
  return { email: data.emailAddress };
}
