import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";
import {
  categoriesTable,
  db,
  emailClassificationsTable,
  scanJobsTable,
  usersTable,
} from "@workspace/db";
import { getLiveSession } from "./google-auth";

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
  subjectPreview: string | null;
  category: string;
  subcategory: string | null;
  confidence: number;
  classifiedAt: string;
  included: boolean;
};

// ---------------------------------------------------------------------------
// Demo seed
// ---------------------------------------------------------------------------

const DEMO_USER_ID = "demo-user";
const DEMO_EMAIL = "alex@northstar.studio";

const DEMO_CLASSIFICATIONS = [
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
  },
];

let seedPromise: Promise<void> | null = null;

async function seedDemo(): Promise<void> {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, DEMO_USER_ID));
  if (existing.length > 0) return;

  await db.insert(usersTable).values({ id: DEMO_USER_ID, email: DEMO_EMAIL });
  await db.insert(categoriesTable).values(
    DEFAULT_CATEGORIES.map((category) => ({
      id: category.id,
      userId: DEMO_USER_ID,
      name: category.name,
      color: category.color,
    })),
  );
  await db.insert(emailClassificationsTable).values(
    DEMO_CLASSIFICATIONS.map((item) => ({
      ...item,
      userId: DEMO_USER_ID,
      classifiedAt: new Date(item.classifiedAt),
    })),
  );
}

async function ensureSeeded(): Promise<void> {
  if (!isDemoMode()) return;
  if (!seedPromise) {
    seedPromise = seedDemo().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

// ---------------------------------------------------------------------------
// Row mapping (DB rows -> API shapes; progress is derived, never stored)
// ---------------------------------------------------------------------------

type ScanJobRow = typeof scanJobsTable.$inferSelect;
type ClassificationRow = typeof emailClassificationsTable.$inferSelect;

function toScanJob(row: ScanJobRow): ScanJobState {
  const progress =
    row.totalMessages > 0
      ? Math.round((row.processedMessages / row.totalMessages) * 100)
      : 100;
  const currentStep =
    row.status === "completed"
      ? "Classification complete"
      : row.status === "queued"
        ? "Queued for processing"
        : progress < 30
          ? "Fetching message metadata"
          : progress < 85
            ? "Classifying sender patterns"
            : "Preparing Gmail label preview";
  return {
    id: row.id,
    status: row.status as ScanStatus,
    totalMessages: row.totalMessages,
    processedMessages: row.processedMessages,
    failedMessages: row.failedMessages,
    progress,
    currentStep,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

function toClassification(row: ClassificationRow): ClassificationState {
  return {
    id: row.id,
    gmailMessageId: row.gmailMessageId,
    gmailThreadId: row.gmailThreadId,
    senderEmail: row.senderEmail,
    senderDomain: row.senderDomain,
    subjectPreview: row.subjectPreview,
    category: row.category,
    subcategory: row.subcategory,
    confidence: row.confidence,
    classifiedAt: row.classifiedAt.toISOString(),
    included: row.included,
  };
}

// TODO(phase-1): persist label applications in Postgres (no table yet).
// Until the Gmail labels workstream lands, this counter resets on restart.
let labelsApplied = 0;

export function isDemoMode(): boolean {
  return process.env.INBOX_CLASSIFIER_DEMO_MODE !== "false";
}

export function getAccount() {
  const live = getLiveSession();
  if (live) {
    return {
      connected: true,
      email: live.email,
      mode: "live" as const,
      lastSyncedAt: null,
    };
  }
  // No live session means no connection — in demo mode the app still serves
  // sample content, but the account must never impersonate a fake identity.
  // (Previously this returned a hardcoded demo user as "connected".)
  if (isDemoMode()) {
    return {
      connected: false,
      email: null,
      mode: "demo" as const,
      lastSyncedAt: null,
    };
  }

  return {
    connected: false,
    email: null,
    mode: "disconnected" as const,
    lastSyncedAt: null,
  };
}

export async function listCategories() {
  await ensureSeeded();
  const [stored, counts] = await Promise.all([
    db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.userId, DEMO_USER_ID)),
    db
      .select({
        category: emailClassificationsTable.category,
        count: count(),
      })
      .from(emailClassificationsTable)
      .where(eq(emailClassificationsTable.userId, DEMO_USER_ID))
      .groupBy(emailClassificationsTable.category),
  ]);
  const countsByName = new Map(counts.map((row) => [row.category, row.count]));
  const total = [...countsByName.values()].reduce((sum, n) => sum + n, 0);
  return stored.map((category) => {
    const categoryCount = countsByName.get(category.name) ?? 0;
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      count: categoryCount,
      share: total > 0 ? categoryCount / total : 0,
    };
  });
}

export async function getDashboard() {
  const categories = await listCategories();
  const scans = await db
    .select({ completedAt: scanJobsTable.completedAt })
    .from(scanJobsTable)
    .where(
      and(
        eq(scanJobsTable.userId, DEMO_USER_ID),
        eq(scanJobsTable.status, "completed"),
      ),
    )
    .orderBy(desc(scanJobsTable.completedAt))
    .limit(1);
  return {
    account: getAccount(),
    totalEmails: categories.reduce((sum, category) => sum + category.count, 0),
    // TODO(phase-1): unread/recurring counts need live Gmail metadata.
    unreadEmails: 1284,
    recurringSenders: 23,
    categories,
    lastScan: scans[0]?.completedAt
      ? scans[0].completedAt.toISOString()
      : null,
    labelsApplied,
    privacyNote:
      "Inbox Classifier keeps Gmail IDs and classification metadata. Message bodies, HTML, attachments, and OAuth tokens are never stored.",
  };
}

async function progressScan(scanId: string) {
  const rows = await db
    .select()
    .from(scanJobsTable)
    .where(
      and(eq(scanJobsTable.id, scanId), eq(scanJobsTable.userId, DEMO_USER_ID)),
    );
  const scan = rows[0];
  if (!scan || scan.status === "completed" || scan.status === "failed") return;

  const nextProcessed = Math.min(
    scan.totalMessages,
    scan.processedMessages + Math.max(1, Math.round(scan.totalMessages / 12)),
  );
  const done = nextProcessed >= scan.totalMessages;
  await db
    .update(scanJobsTable)
    .set({
      status: done ? "completed" : "running",
      processedMessages: nextProcessed,
      ...(done ? { completedAt: new Date() } : {}),
    })
    .where(eq(scanJobsTable.id, scanId));

  if (!done) {
    setTimeout(() => void progressScan(scanId), 550);
  }
}

export async function createScan(maxMessages: number): Promise<ScanJobState> {
  await ensureSeeded();
  const dashboard = await getDashboard();
  const totalMessages = Math.min(maxMessages, dashboard.totalEmails);
  const [row] = await db
    .insert(scanJobsTable)
    .values({
      id: randomUUID(),
      userId: DEMO_USER_ID,
      status: totalMessages === 0 ? "completed" : "queued",
      totalMessages,
      processedMessages: 0,
      failedMessages: 0,
      startedAt: new Date(),
      ...(totalMessages === 0 ? { completedAt: new Date() } : {}),
    })
    .returning();
  if (totalMessages > 0) {
    setTimeout(() => void progressScan(row.id), 400);
  }
  return toScanJob(row);
}

export async function listScans(): Promise<ScanJobState[]> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(scanJobsTable)
    .where(eq(scanJobsTable.userId, DEMO_USER_ID))
    .orderBy(desc(scanJobsTable.startedAt));
  return rows.map(toScanJob);
}

export async function getScan(scanId: string): Promise<ScanJobState | null> {
  await ensureSeeded();
  const rows = await db
    .select()
    .from(scanJobsTable)
    .where(
      and(eq(scanJobsTable.id, scanId), eq(scanJobsTable.userId, DEMO_USER_ID)),
    );
  return rows[0] ? toScanJob(rows[0]) : null;
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export async function listClassifications(filters: {
  category?: string;
  sender?: string;
  limit?: number;
}): Promise<ClassificationState[]> {
  await ensureSeeded();
  const conditions = [eq(emailClassificationsTable.userId, DEMO_USER_ID)];
  if (filters.category) {
    conditions.push(
      ilike(emailClassificationsTable.category, filters.category),
    );
  }
  if (filters.sender) {
    conditions.push(
      ilike(
        emailClassificationsTable.senderDomain,
        `%${escapeLike(filters.sender)}%`,
      ),
    );
  }
  const rows = await db
    .select()
    .from(emailClassificationsTable)
    .where(and(...conditions))
    .orderBy(desc(emailClassificationsTable.classifiedAt))
    .limit(filters.limit ?? 50);
  return rows.map(toClassification);
}

export async function applyClassificationUpdate(
  id: string,
  update: { category?: string; included?: boolean },
): Promise<ClassificationState | null> {
  await ensureSeeded();
  const patch: { category?: string; included?: boolean } = {};
  if (update.category !== undefined) patch.category = update.category;
  if (update.included !== undefined) patch.included = update.included;
  const rows = await db
    .update(emailClassificationsTable)
    .set(patch)
    .where(
      and(
        eq(emailClassificationsTable.id, id),
        eq(emailClassificationsTable.userId, DEMO_USER_ID),
      ),
    )
    .returning();
  return rows[0] ? toClassification(rows[0]) : null;
}

export async function applyLabels(classificationIds: string[]) {
  await ensureSeeded();
  if (classificationIds.length === 0) {
    return {
      status: "completed" as const,
      labelsCreated: 0,
      messagesLabeled: 0,
      failedMessages: 0,
      message: "Gmail labels are ready to review in your inbox.",
    };
  }
  const rows = await db
    .select()
    .from(emailClassificationsTable)
    .where(
      and(
        inArray(emailClassificationsTable.id, classificationIds),
        eq(emailClassificationsTable.userId, DEMO_USER_ID),
        eq(emailClassificationsTable.included, true),
      ),
    );
  labelsApplied += rows.length;
  return {
    status: "completed" as const,
    labelsCreated: new Set(rows.map((item) => item.category)).size,
    messagesLabeled: rows.length,
    failedMessages: 0,
    message: "Gmail labels are ready to review in your inbox.",
  };
}
