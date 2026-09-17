import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  ApplyLabelsBody,
  ApplyLabelsResponse,
  CreateScanBody,
  CreateScanResponse,
  DisconnectGoogleAccountResponse,
  GetAccountResponse,
  GetDashboardResponse,
  GetScanParams,
  GetScanResponse,
  ListCategoriesResponse,
  ListClassificationsQueryParams,
  ListClassificationsResponse,
  ListScansResponse,
  UpdateClassificationBody,
  UpdateClassificationParams,
  UpdateClassificationResponse,
} from "@workspace/api-zod";
import {
  applyClassificationUpdate,
  applyLabels,
  createScan,
  getAccount,
  getDashboard,
  getScan,
  listCategories,
  listClassifications,
  listScans,
} from "../lib/inbox-state";
import {
  clearLiveSession,
  exchangeCodeForTokens,
  fetchGmailProfile,
  OAuthExchangeError,
  storeLiveSession,
} from "../lib/google-auth";

const router: IRouter = Router();

router.get("/account", (_req, res) => {
  res.json(GetAccountResponse.parse(getAccount()));
});

router.get("/account/connect", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${req.protocol}://${req.get("host")}/api/account/callback`;

  if (!clientId) {
    res.redirect(302, "/?oauth=not-configured");
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" "),
  });
  res.redirect(
    302,
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
});

router.get("/account/callback", async (req, res) => {
  const error = req.query.error;
  if (typeof error === "string") {
    res.status(400).json({ error });
    return;
  }
  const code = req.query.code;
  if (typeof code !== "string" || code.length === 0) {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }
  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGmailProfile(tokens.accessToken);
    storeLiveSession(profile.email, tokens);
    // Login finishes in a browser tab, so answer with a redirect back to
    // the app (settings shows the now-live account) instead of JSON.
    const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(
      /\/+$/,
      "",
    );
    res.redirect(302, `${appUrl}/settings`);
  } catch (err) {
    if (err instanceof OAuthExchangeError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    // Log the stage that failed (message only — tokens never reach logs).
    logger.error(
      { signInError: err instanceof Error ? err.message : String(err) },
      "Google sign-in failed",
    );
    res
      .status(502)
      .json({ error: "Google sign-in failed. Please try again." });
  }
});

router.post("/account/disconnect", (_req, res) => {
  clearLiveSession();
  res.json(
    DisconnectGoogleAccountResponse.parse({
      connected: false,
      email: null,
      mode: "disconnected",
      lastSyncedAt: null,
    }),
  );
});

router.get("/dashboard", async (_req, res) => {
  res.json(GetDashboardResponse.parse(await getDashboard()));
});

router.get("/categories", async (_req, res) => {
  res.json(ListCategoriesResponse.parse(await listCategories()));
});

router.post("/scans", async (req, res) => {
  const parsed = CreateScanBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const scan = await createScan(parsed.data.maxMessages);
  res.status(202).json(CreateScanResponse.parse(scan));
});

router.get("/scans", async (_req, res) => {
  res.json(ListScansResponse.parse(await listScans()));
});

router.get("/scans/:scanId", async (req, res) => {
  const parsed = GetScanParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scan = await getScan(parsed.data.scanId);
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.json(GetScanResponse.parse(scan));
});

router.get("/classifications", async (req, res) => {
  const parsed = ListClassificationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filtered = await listClassifications({
    category: parsed.data.category,
    sender: parsed.data.sender,
    limit: parsed.data.limit,
  });

  res.json(ListClassificationsResponse.parse(filtered));
});

router.patch("/classifications/:classificationId", async (req, res) => {
  const params = UpdateClassificationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateClassificationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updated = await applyClassificationUpdate(
    params.data.classificationId,
    body.data,
  );
  if (!updated) {
    res.status(404).json({ error: "Classification not found" });
    return;
  }
  res.json(UpdateClassificationResponse.parse(updated));
});

router.post("/labels/apply", async (req, res) => {
  const parsed = ApplyLabelsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.status(202).json(
    ApplyLabelsResponse.parse(await applyLabels(parsed.data.classificationIds)),
  );
});

export default router;