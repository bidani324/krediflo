import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { loansTable } from "./loans";

export const applicantTypeEnum = pgEnum("applicant_type", [
  "primary",
  "co-applicant",
]);

export const applicantsTable = pgTable("applicants", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id")
    .notNull()
    .references(() => loansTable.id, { onDelete: "cascade" }),
  applicantType: applicantTypeEnum("applicant_type").notNull().default("primary"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  mobile: text("mobile").notNull(),
  pan: text("pan").notNull(),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  cibilScore: integer("cibil_score"),
  cibilStatus: text("cibil_status"),
  panVerified: boolean("pan_verified").notNull().default(false),
  mcaVerified: boolean("mca_verified").notNull().default(false),
  bankStatementsStatus: text("bank_statements_status"),
  docsLastFetchedAt: timestamp("docs_last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertApplicantSchema = createInsertSchema(applicantsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertApplicant = z.infer<typeof insertApplicantSchema>;
export type Applicant = typeof applicantsTable.$inferSelect;
