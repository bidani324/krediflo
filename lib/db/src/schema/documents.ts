import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { applicantsTable } from "./applicants";

export const docTypeEnum = pgEnum("doc_type", [
  "cibil_report",
  "pan_verification",
  "mca_data",
  "bank_statement",
  "bsa_analysis",
  "commercial_cibil",
  "form_16",
  "itr",
]);

export const docStatusEnum = pgEnum("doc_status", [
  "pending",
  "fetching",
  "fetched",
  "failed",
]);

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id")
    .notNull()
    .references(() => applicantsTable.id, { onDelete: "cascade" }),
  docType: docTypeEnum("doc_type").notNull(),
  status: docStatusEnum("status").notNull().default("pending"),
  data: jsonb("data"),
  fileName: text("file_name"),
  fileData: text("file_data"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;
