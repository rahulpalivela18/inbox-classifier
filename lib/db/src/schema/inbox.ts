import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("inbox_users", {
  id: text("id").primaryKey(),
  googleUserId: text("google_user_id").unique(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categoriesTable = pgTable("inbox_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailClassificationsTable = pgTable("email_classifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  gmailMessageId: text("gmail_message_id").notNull(),
  gmailThreadId: text("gmail_thread_id").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderDomain: text("sender_domain").notNull(),
  subjectPreview: text("subject_preview"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  confidence: real("confidence").notNull(),
  included: boolean("included").notNull().default(true),
  classifiedAt: timestamp("classified_at", { withTimezone: true }).notNull().defaultNow(),
  // Last import/sync that observed this message still present in Gmail.
  // Rows unseen for a long time are candidates for archive/hide — never
  // hard-deleted, since manual categories are user work worth keeping.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const scanJobsTable = pgTable("scan_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  status: text("status").notNull(),
  totalMessages: integer("total_messages").notNull().default(0),
  processedMessages: integer("processed_messages").notNull().default(0),
  failedMessages: integer("failed_messages").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const unsubscribeActionsTable = pgTable("unsubscribe_actions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderDomain: text("sender_domain").notNull(),
  status: text("status").notNull(),
  method: text("method").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  createdAt: true,
});
export const insertEmailClassificationSchema = createInsertSchema(
  emailClassificationsTable,
).omit({ classifiedAt: true });
export const insertScanJobSchema = createInsertSchema(scanJobsTable);
export const insertUnsubscribeActionSchema = createInsertSchema(
  unsubscribeActionsTable,
).omit({ createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
export type InsertEmailClassification = z.infer<
  typeof insertEmailClassificationSchema
>;
export type EmailClassification = typeof emailClassificationsTable.$inferSelect;
export type InsertScanJob = z.infer<typeof insertScanJobSchema>;
export type ScanJob = typeof scanJobsTable.$inferSelect;
export type InsertUnsubscribeAction = z.infer<
  typeof insertUnsubscribeActionSchema
>;
export type UnsubscribeAction = typeof unsubscribeActionsTable.$inferSelect;