import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { loansTable } from "./loans";
import { usersTable } from "./users";

export const loanUploadsTable = pgTable("loan_uploads", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id")
    .notNull()
    .references(() => loansTable.id, { onDelete: "cascade" }),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  docLabel: text("doc_label").notNull(),
  fileName: text("file_name").notNull(),
  fileData: text("file_data").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoanUpload = typeof loanUploadsTable.$inferSelect;
export type InsertLoanUpload = typeof loanUploadsTable.$inferInsert;
