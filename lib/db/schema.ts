import {
  pgTable, pgEnum, text, integer, boolean, timestamp, date, jsonb, serial, primaryKey, uniqueIndex, index, doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["ADMIN", "USER"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
export const priorityEnum = pgEnum("priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const clientStageEnum = pgEnum("client_stage", ["ONBOARDING", "ACTIVE", "CLOSING", "CLOSED"]);
export const dealStageEnum = pgEnum("deal_stage", ["LEAD", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"]);
export const decisionEnum = pgEnum("decision", ["APPROVED", "REJECTED"]);
export const documentStatusEnum = pgEnum("document_status", ["DRAFT", "OUT_FOR_SIGNATURE", "COMPLETED", "VOIDED"]);
export const signerStatusEnum = pgEnum("signer_status", ["PENDING", "SIGNED", "DECLINED"]);
export const fieldTypeEnum = pgEnum("document_field_type", ["SIGNATURE", "INITIALS", "DATE", "NAME", "TEXT"]);
export const projectCategoryEnum = pgEnum("project_category", ["WEBSITE", "WEB_APP", "MOBILE_APP", "AI_AUTOMATION", "OTHER"]);

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
  /** Why a deal was lost (LOST_REASONS key). Only set while the stage is LOST. */
  lostReason: text("lost_reason"),
  lostNote: text("lost_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Comments people leave on a ticket. */
export const ticketComments = pgTable("ticket_comments", {
  id: id(),
  ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
}, (t) => [index("ticket_comments_ticket_idx").on(t.ticketId)]);

/** Activity log: who changed what on a ticket, and when. */
export const ticketEvents = pgTable("ticket_events", {
  id: id(),
  ticketId: text("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  /** Human-readable change, e.g. "moved it from To do to In progress". */
  detail: text("detail").notNull(),
  createdAt: createdAt(),
}, (t) => [index("ticket_events_ticket_idx").on(t.ticketId)]);

/** A finished project, with every link the team needs (live site, admin panel, store pages, repo, docs). */
export const projects = pgTable("projects", {
  id: id(),
  name: text("name").notNull(),
  category: projectCategoryEnum("category").notNull(),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  liveUrl: text("live_url"),
  /** Other links, in display order: [{ label: "Admin panel", url: "https://…" }] */
  links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),
  description: text("description"),
  tech: jsonb("tech").$type<string[]>().notNull().default([]),
  completedOn: date("completed_on"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("projects_category_idx").on(t.category)]);

/** A PDF uploaded for signing. Files live in private Vercel Blob storage; only their storage path is kept here. */
export const documents = pgTable("documents", {
  id: id(),
  title: text("title").notNull(),
  message: text("message"),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  status: documentStatusEnum("status").notNull().default("DRAFT"),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileSha256: text("file_sha256").notNull(),
  pageCount: integer("page_count").notNull(),
  signedPath: text("signed_path"),
  signedSha256: text("signed_sha256"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("documents_status_idx").on(t.status), index("documents_created_by_idx").on(t.createdById)]);

/** A team member who must sign a document. Name and email are copied at send time for the audit page. */
export const documentSigners = pgTable("document_signers", {
  id: id(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  status: signerStatusEnum("status").notNull().default("PENDING"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  declinedAt: timestamp("declined_at", { withTimezone: true }),
  declineReason: text("decline_reason"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
}, (t) => [index("document_signers_document_idx").on(t.documentId), index("document_signers_user_idx").on(t.userId)]);

/** A box on a page that one signer fills. Position and size are fractions (0–1) of the page as displayed. */
export const documentFields = pgTable("document_fields", {
  id: id(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  signerId: text("signer_id").notNull().references(() => documentSigners.id, { onDelete: "cascade" }),
  type: fieldTypeEnum("type").notNull(),
  page: integer("page").notNull(),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  w: doublePrecision("w").notNull(),
  h: doublePrecision("h").notNull(),
  required: boolean("required").notNull().default(true),
  label: text("label"),
  value: text("value"),
  filledAt: timestamp("filled_at", { withTimezone: true }),
}, (t) => [index("document_fields_document_idx").on(t.documentId)]);

/** Audit trail for a document: uploads, sends, views, signatures, declines, voids. */
export const documentEvents = pgTable("document_events", {
  id: id(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  detail: text("detail").notNull(),
  ip: text("ip"),
  createdAt: createdAt(),
}, (t) => [index("document_events_document_idx").on(t.documentId)]);

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
export type TicketComment = typeof ticketComments.$inferSelect;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type DocumentSigner = typeof documentSigners.$inferSelect;
export type DocumentField = typeof documentFields.$inferSelect;
