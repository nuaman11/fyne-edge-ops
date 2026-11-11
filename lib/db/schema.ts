import {
  pgTable, pgEnum, text, integer, boolean, timestamp, date, jsonb, serial, primaryKey, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["ADMIN", "USER"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
export const priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const clientStageEnum = pgEnum("client_stage", ["ONBOARDING", "ACTIVE", "CLOSING", "CLOSED"]);
export const dealStageEnum = pgEnum("deal_stage", ["LEAD", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]);
export const decisionEnum = pgEnum("decision", ["APPROVED", "REJECTED"]);

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("USER"),
  department: text("department").notNull().default("Engineering"),
  jobTitle: text("job_title"),
  isDeptHead: boolean("is_dept_head").notNull().default(false),
  active: boolean("active").notNull().default(true),
  /** Bumped on password change, role change or deactivation; old sessions stop working. */
  sessionVersion: integer("session_version").notNull().default(1),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export type ChecklistState = Record<string, boolean>;

export const clients = pgTable("clients", {
  id: id(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  service: text("service").notNull().default("Website"),
  value: integer("value").notNull().default(0),
  stage: clientStageEnum("stage").notNull().default("ONBOARDING"),
  startDate: date("start_date"),
  closedAt: date("closed_at"),
  notes: text("notes"),
  onboarding: jsonb("onboarding").$type<ChecklistState>().notNull().default({}),
  closing: jsonb("closing").$type<ChecklistState>().notNull().default({}),
  leadId: text("lead_id").references(() => users.id, { onDelete: "set null" }),
  fromDealId: text("from_deal_id").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const clientDevelopers = pgTable("client_developers", {
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.clientId, t.userId] })]);

export const tickets = pgTable("tickets", {
  id: id(),
  number: serial("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: ticketStatusEnum("status").notNull().default("TODO"),
  priority: priorityEnum("priority").notNull().default("MEDIUM"),
  dueDate: date("due_date"),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("tickets_status_idx").on(t.status), index("tickets_due_idx").on(t.dueDate)]);

export const hiringRequests = pgTable("hiring_requests", {
  id: id(),
  candidate: text("candidate").notNull(),
  position: text("position").notNull(),
  department: text("department").notNull(),
  startDate: date("start_date"),
  notes: text("notes"),
  requiredDepartments: text("required_departments").array().notNull().default([]),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const hiringApprovals = pgTable("hiring_approvals", {
  id: id(),
  requestId: text("request_id").notNull().references(() => hiringRequests.id, { onDelete: "cascade" }),
  department: text("department").notNull(),
  decision: decisionEnum("decision").notNull(),
  decidedById: text("decided_by_id").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("hiring_approval_unique").on(t.requestId, t.department)]);

export const deals = pgTable("deals", {
  id: id(),
  company: text("company").notNull(),
  contactName: text("contact_name"),
  service: text("service").notNull().default("Website"),
  value: integer("value").notNull().default(0),
  stage: dealStageEnum("stage").notNull().default("LEAD"),
  expectedClose: date("expected_close"),
  source: text("source"),
  nextAction: text("next_action"),
  notes: text("notes"),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const clientsRelations = relations(clients, ({ many }) => ({ developers: many(clientDevelopers) }));
export const clientDevelopersRelations = relations(clientDevelopers, ({ one }) => ({
  client: one(clients, { fields: [clientDevelopers.clientId], references: [clients.id] }),
  user: one(users, { fields: [clientDevelopers.userId], references: [users.id] }),
}));
export const hiringRequestsRelations = relations(hiringRequests, ({ many }) => ({ approvals: many(hiringApprovals) }));
export const hiringApprovalsRelations = relations(hiringApprovals, ({ one }) => ({
  request: one(hiringRequests, { fields: [hiringApprovals.requestId], references: [hiringRequests.id] }),
}));

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type HiringRequest = typeof hiringRequests.$inferSelect;
export type HiringApproval = typeof hiringApprovals.$inferSelect;
