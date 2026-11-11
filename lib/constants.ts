export const DEPARTMENTS = ["Engineering", "Design", "Sales", "HR", "Finance", "Management"] as const;
export const SERVICES = ["Website", "Web app", "Mobile app", "Maintenance", "Other"] as const;

export const TICKET_STATUSES = [["TODO", "To do"], ["IN_PROGRESS", "In progress"], ["IN_REVIEW", "In review"], ["DONE", "Done"]] as const;
export const PRIORITIES = [["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"], ["URGENT", "Urgent"]] as const;
export const CLIENT_STAGES = [["ONBOARDING", "Onboarding"], ["ACTIVE", "Active"], ["CLOSING", "Closing"], ["CLOSED", "Closed"]] as const;
export const DEAL_STAGES = [["LEAD", "Lead"], ["CONTACTED", "Contacted"], ["PROPOSAL", "Proposal sent"], ["NEGOTIATION", "Negotiation"], ["WON", "Won"], ["LOST", "Lost"]] as const;

export const ONBOARDING_ITEMS = [
  ["contract", "Contract signed"],
  ["deposit", "Deposit received"],
  ["brief", "Requirements brief agreed"],
  ["kickoff", "Kickoff meeting held"],
  ["access", "Accounts & access shared"],
] as const;

export const CLOSING_ITEMS = [
  ["delivered", "Final build delivered"],
  ["signoff", "Client sign-off received"],
  ["invoice", "Final invoice sent"],
  ["paid", "Final payment received"],
  ["handover", "Handover & credentials sent"],
  ["feedback", "Feedback / testimonial requested"],
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number][0];
export type Priority = (typeof PRIORITIES)[number][0];
export type ClientStage = (typeof CLIENT_STAGES)[number][0];
export type DealStage = (typeof DEAL_STAGES)[number][0];

export function label(list: readonly (readonly [string, string])[], v: string | null | undefined) {
  return list.find((x) => x[0] === v)?.[1] ?? v ?? "";
}
