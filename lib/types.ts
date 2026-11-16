import type { ClientStage, DealStage, Priority, TicketStatus } from "./constants";

export type Me = { id: string; name: string; role: "ADMIN" | "USER"; department: string; isDeptHead: boolean };
export type UserLite = { id: string; name: string; role: "ADMIN" | "USER"; department: string; jobTitle: string | null; isDeptHead: boolean; active: boolean };
export type UserAdminRow = UserLite & { email: string; lastLoginAt: string | null; createdAt: string };
export type TicketRow = {
  id: string; number: number; title: string; description: string | null; status: TicketStatus; priority: Priority;
  dueDate: string | null; clientId: string | null; assigneeId: string | null; createdById: string | null; commentCount: number;
};
export type ClientRow = {
  id: string; name: string; contactName: string | null; phone: string | null; email: string | null; service: string; value: number;
  stage: ClientStage; startDate: string | null; closedAt: string | null; notes: string | null;
  onboarding: Record<string, boolean>; closing: Record<string, boolean>; leadId: string | null; developerIds: string[];
};
export type DealRow = {
  id: string; company: string; contactName: string | null; service: string; value: number; stage: DealStage;
  expectedClose: string | null; source: string | null; nextAction: string | null; notes: string | null; clientId: string | null;
  lostReason: string | null; lostNote: string | null;
};
export type HiringRow = {
  id: string; candidate: string; position: string; department: string; startDate: string | null; notes: string | null;
  requiredDepartments: string[]; createdAt: string;
  approvals: { department: string; decision: "APPROVED" | "REJECTED"; decidedById: string | null; decidedAt: string }[];
};

export function hiringStatus(h: Pick<HiringRow, "requiredDepartments" | "approvals">): "pending" | "approved" | "rejected" {
  const by = new Map(h.approvals.map((a) => [a.department, a.decision]));
  if (h.requiredDepartments.some((d) => by.get(d) === "REJECTED")) return "rejected";
  if (h.requiredDepartments.length && h.requiredDepartments.every((d) => by.get(d) === "APPROVED")) return "approved";
  return "pending";
}

export function canApproveDept(me: Pick<Me, "role" | "department" | "isDeptHead">, dept: string) {
  return me.role === "ADMIN" || (me.isDeptHead && me.department === dept);
}

export type TicketThread = {
  createdAt: string; createdById: string | null;
  comments: { id: string; authorId: string | null; body: string; createdAt: string }[];
  events: { id: string; actorId: string | null; detail: string; createdAt: string }[];
};
