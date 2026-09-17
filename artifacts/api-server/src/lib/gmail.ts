// Server-only Gmail read service (fetch with plain HTTPS, no SDK).
//
// Deliberately minimal: list message IDs, then fetch sender/subject/date
// per message. Bodies, attachments, and full payloads are never requested
// (format=metadata) and never stored. Classification comes later.

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailTokenExpiredError = { name: "GmailTokenExpiredError" };

export class GmailApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function gmailFetch(
  accessToken: string,
  path: string,
): Promise<unknown> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    // Access tokens live ~1h. Refresh flow lands with durable sessions;
    // for now, surface re-login.
    const err = new Error(
      "Gmail access expired. Sign in again to continue.",
    ) as Error & { name: string };
    err.name = "GmailTokenExpiredError";
    throw err;
  }
  if (!res.ok) {
    throw new GmailApiError(
      res.status,
      `Gmail request failed (HTTP ${res.status}).`,
    );
  }
  return res.json();
}

export type GmailMessageRef = {
  id: string;
  threadId: string;
};

export async function listMessageIds(
  accessToken: string,
  maxResults = 100,
): Promise<GmailMessageRef[]> {
  // messages.list pages (500 per page max) — follow nextPageToken until we
  // have enough or the inbox is exhausted. No artificial ceiling here.
  const out: GmailMessageRef[] = [];
  let pageToken: string | undefined;
  const want = Math.min(Math.max(maxResults, 1), 5000);
  while (out.length < want) {
    const pageSize = Math.min(500, want - out.length);
    const params = new URLSearchParams({ maxResults: String(pageSize) });
    if (pageToken) params.set("pageToken", pageToken);
    const data = (await gmailFetch(
      accessToken,
      `/messages?${params.toString()}`,
    )) as { messages?: GmailMessageRef[]; nextPageToken?: string };
    out.push(...(data.messages ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export type GmailMetadata = {
  id: string;
  threadId: string;
  from: string | null;
  subject: string | null;
  date: string | null;
  snippet: string | null;
};

type MetadataPayload = {
  id?: string;
  threadId?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
};

function header(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string | null {
  const found = headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

export async function getMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<GmailMetadata> {
  const data = (await gmailFetch(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
  )) as MetadataPayload;
  return {
    id: data.id ?? messageId,
    threadId: data.threadId ?? "",
    from: header(data.payload?.headers, "From"),
    subject: header(data.payload?.headers, "Subject"),
    date: header(data.payload?.headers, "Date"),
    snippet: data.snippet ?? null,
  };
}

export async function listInboxMetadata(
  accessToken: string,
  maxResults = 100,
): Promise<GmailMetadata[]> {
  const refs = await listMessageIds(accessToken, maxResults);
  // Metadata fetches are independent — run in concurrent chunks of 10
  // (well within Gmail rate limits) instead of one-by-one.
  const out: GmailMetadata[] = [];
  for (let i = 0; i < refs.length; i += 10) {
    const chunk = refs.slice(i, i + 10);
    out.push(
      ...(await Promise.all(
        chunk.map((ref) => getMessageMetadata(accessToken, ref.id)),
      )),
    );
  }
  return out;
}
