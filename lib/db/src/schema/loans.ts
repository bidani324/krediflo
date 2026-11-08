import {
  pgTable,
  text,
  serial,
  timestamp,
  numeric,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const loanTypeEnum = pgEnum("loan_type", [
  "lap",
  "home",
  "personal",
  "business",
]);

export const loanStatusEnum = pgEnum("loan_status", [
  "draft",
  "submitted",
  "docs_procured",
  "under_review",
  "sent_to_bank",
  "approved",
  "rejected",
]);

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  loanType: loanTypeEnum("loan_type").notNull(),
  loanAmount: numeric("loan_amount", { precision: 15, scale: 2 }).notNull(),
  tenure: integer("tenure").notNull(),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }),
  purpose: text("purpose"),
  status: loanStatusEnum("status").notNull().default("draft"),
  propertyValue: numeric("property_value", { precision: 15, scale: 2 }),
  propertyAddress: text("property_address"),
  annualIncome: numeric("annual_income", { precision: 15, scale: 2 }),
  employmentType: text("employment_type"),
  companyName: text("company_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLoanSchema = createInsertSchema(loansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loansTable.$inferSelect;
