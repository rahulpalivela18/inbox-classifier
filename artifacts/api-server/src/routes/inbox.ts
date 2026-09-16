import { Router, type IRouter } from "express";
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
  categories,
  classifications,
  createScan,
  getAccount,
  getDashboard,
  scans,
} from "../lib/inbox-state";

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

router.post("/account/disconnect", (_req, res) => {
  res.json(
    DisconnectGoogleAccountResponse.parse({
      connected: false,
      email: null,
      mode: "disconnected",
      lastSyncedAt: null,
    }),
  );
});

router.get("/dashboard", (_req, res) => {
  res.json(GetDashboardResponse.parse(getDashboard()));
});

router.get("/categories", (_req, res) => {
  res.json(ListCategoriesResponse.parse(categories));
});

router.post("/scans", (req, res) => {
  const parsed = CreateScanBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const scan = createScan(parsed.data.maxMessages);
  res.status(202).json(CreateScanResponse.parse(scan));
});

router.get("/scans", (_req, res) => {
  res.json(ListScansResponse.parse(Array.from(scans.values()).reverse()));
});

router.get("/scans/:scanId", (req, res) => {
  const parsed = GetScanParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const scan = scans.get(parsed.data.scanId);
  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }
  res.json(GetScanResponse.parse(scan));
});

router.get("/classifications", (req, res) => {
  const parsed = ListClassificationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filtered = classifications
    .filter((item) =>
      parsed.data.category
        ? item.category.toLowerCase() === parsed.data.category.toLowerCase()
        : true,
    )
    .filter((item) =>
      parsed.data.sender
        ? item.senderDomain
            .toLowerCase()
            .includes(parsed.data.sender.toLowerCase())
        : true,
    )
    .slice(0, parsed.data.limit);

  res.json(ListClassificationsResponse.parse(filtered));
});

router.patch("/classifications/:classificationId", (req, res) => {
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
  const updated = applyClassificationUpdate(
    params.data.classificationId,
    body.data,
  );
  if (!updated) {
    res.status(404).json({ error: "Classification not found" });
    return;
  }
  res.json(UpdateClassificationResponse.parse(updated));
});

router.post("/labels/apply", (req, res) => {
  const parsed = ApplyLabelsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.status(202).json(
    ApplyLabelsResponse.parse(applyLabels(parsed.data.classificationIds)),
  );
});

export default router;