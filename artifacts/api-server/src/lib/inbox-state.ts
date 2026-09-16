import { randomUUID } from "node:crypto";

export const DEFAULT_CATEGORIES = [
  { id: "work", name: "Work", color: "#5F6FFF" },
  { id: "finance", name: "Finance", color: "#1C9B78" },
  { id: "shopping", name: "Shopping", color: "#F29A4A" },
  { id: "newsletter", name: "Newsletter", color: "#C86BDF" },
  { id: "travel", name: "Travel", color: "#3FA9F5" },
  { id: "personal", name: "Personal", color: "#E56B6F" },
  { id: "promotion", name: "Promotion", color: "#E5BF3F" },
  { id: "other", name: "Other", color: "#96A3B5" },
] as const;

export type ScanStatus = "queued" | "running" | "completed" | "failed";

export type ScanJobState = {
  id: string;
  status: ScanStatus;
  totalMessages: number;
  processedMessages: number;
  failedMessages: number;
  progress: number;
  currentStep: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type ClassificationState = {
  id: string;
  gmailMessageId: string;
  gmailThreadId: string;
  senderEmail: string;
  senderDomain: string;
  subjectPreview: string;
  category: string;
  subcategory: string | null;
  confidence: number;
  classifiedAt: string;
  included: boolean;
};

const demoCounts = [1204, 384, 612, 1743, 188, 511, 426, 367];

export const categories = DEFAULT_CATEGORIES.map((category, index) => ({
  ...category,
  count: demoCounts[index],
  share: demoCounts[index] / demoCounts.reduce((sum, count) => sum + count, 0),
}));

export const scans = new Map<string, ScanJobState>();

export const classifications: ClassificationState[] = [
  {
    id: "classification-medium",
    gmailMessageId: "demo-medium-1",
    gmailThreadId: "demo-thread-medium",
    senderEmail: "hello@medium.com",
    senderDomain: "medium.com",
    subjectPreview: "The stories worth your time this week",
    category: "Newsletter",
    subcategory: "Tech",
    confidence: 0.96,
    classifiedAt: "2026-09-16T08:12:00.000Z",
    included: true,
  },
  {
    id: "classification-stripe",
    gmailMessageId: "demo-stripe-1",
    gmailThreadId: "demo-thread-stripe",
    senderEmail: "receipts@stripe.com",
    senderDomain: "stripe.com",
    subjectPreview: "Your Stripe receipt is ready",
    category: "Finance",
    subcategory: "Receipts",
    confidence: 0.98,
    classifiedAt: "2026-09-16T08:10:00.000Z",
    included: true,
  },
  {
    id: "classification-linear",
    gmailMessageId: "demo-linear-1",
    gmailThreadId: "demo-thread-linear",
    senderEmail: "updates@linear.app",
    senderDomain: "linear.app",
    subjectPreview: "Your team has 4 new updates",
    category: "Work",
    subcategory: "Project updates",
    confidence: 0.92,
    classifiedAt: "2026-09-16T08:08:00.000Z",
    included: true,
  },
  {
    id: "classification-airbnb",
    gmailMessageId: "demo-airbnb-1",
    gmailThreadId: "demo-thread-airbnb",
    senderEmail: "automated@airbnb.com",
    senderDomain: "airbnb.com",
    subjectPreview: "Your stay in Lisbon is confirmed",
    category: "Travel",
    subcategory: "Bookings",
    confidence: 0.95,
    classifiedAt: "2026-09-16T08:02:00.000Z",
    included: true,
  },
  {
    id: "classification-patagonia",
    gmailMessageId: "demo-patagonia-1",
    gmailThreadId: "demo-thread-patagonia",
    senderEmail: "stories@patagonia.com",
    senderDomain: "patagonia.com",
    subjectPreview: "New layers for the changing season",
    category: "Promotion",
    subcategory: "Retail",
    confidence: 0.87,
    classifiedAt: "2026-09-16T07:56:00.000Z",
    included: true,
  },
  {
    id: "classification-mom",
    gmailMessageId: "demo-mom-1",
    gmailThreadId: "demo-thread-mom",
    senderEmail: "mom@example.com",
    senderDomain: "example.com",
    subjectPreview: "Dinner on Sunday?",
    category: "Personal",
    subcategory: "Family",
    confidence: 0.99,
    classifiedAt: "2026-09-16T07:45:00.000Z",
    included: true,
  },
];

let labelsApplied = 0;
let lastScan: string | null = "2026-09-16T08:12:00.000Z";

export function isDemoMode(): boolean {
  return process.env.INBOX_CLASSIFIER_DEMO_MODE !== "false";
}

export function getAccount() {
  if (isDemoMode()) {
    return {
      connected: true,
      email: "alex@northstar.studio",
      mode: "demo" as const,
      lastSyncedAt: lastScan,
    };
  }

  return {
    connected: false,
    email: null,
    mode: "disconnected" as const,
    lastSyncedAt: null,
  };
}

export function getDashboard() {
  return {
    account: getAccount(),
    totalEmails: categories.reduce((sum, category) => sum + category.count, 0),
    unreadEmails: 1284,
    recurringSenders: 23,
    categories,
    lastScan,
    labelsApplied,
    privacyNote:
      "Inbox Classifier keeps Gmail IDs and classification metadata. Message bodies, HTML, attachments, and OAuth tokens are never stored.",
  };
}

function progressScan(scan: ScanJobState) {
  const nextProcessed = Math.min(
    scan.totalMessages,
    scan.processedMessages + Math.max(1, Math.round(scan.totalMessages / 12)),
  );
  scan.status = "running";
  scan.processedMessages = nextProcessed;
  scan.progress = Math.round((nextProcessed / scan.totalMessages) * 100);
  scan.currentStep =
    scan.progress < 30
      ? "Fetching message metadata"
      : scan.progress < 85
        ? "Classifying sender patterns"
        : "Preparing Gmail label preview";

  if (scan.processedMessages >= scan.totalMessages) {
    scan.status = "completed";
    scan.progress = 100;
    scan.currentStep = "Classification complete";
    scan.completedAt = new Date().toISOString();
    lastScan = scan.completedAt;
    return;
  }

  setTimeout(() => progressScan(scan), 550);
}

export function createScan(maxMessages: number): ScanJobState {
  const scan: ScanJobState = {
    id: randomUUID(),
    status: "queued",
    totalMessages: Math.min(maxMessages, getDashboard().totalEmails),
    processedMessages: 0,
    failedMessages: 0,
    progress: 0,
    currentStep: "Queued for processing",
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  scans.set(scan.id, scan);
  setTimeout(() => progressScan(scan), 400);
  return scan;
}

export function applyClassificationUpdate(
  id: string,
  update: { category?: string; included?: boolean },
) {
  const classification = classifications.find((item) => item.id === id);
  if (!classification) return null;
  if (update.category !== undefined) classification.category = update.category;
  if (update.included !== undefined) classification.included = update.included;
  return classification;
}

export function applyLabels(classificationIds: string[]) {
  const selected = classifications.filter(
    (classification) =>
      classificationIds.includes(classification.id) && classification.included,
  );
  labelsApplied += selected.length;
  return {
    status: "completed" as const,
    labelsCreated: new Set(selected.map((item) => item.category)).size,
    messagesLabeled: selected.length,
    failedMessages: 0,
    message: "Gmail labels are ready to review in your inbox.",
  };
}