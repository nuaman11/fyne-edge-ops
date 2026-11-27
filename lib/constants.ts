export const DEPARTMENTS = ["Engineering", "Design", "Sales", "HR", "Finance", "Management"] as const;
export const SERVICES = ["Website", "Web app", "Mobile app", "Maintenance", "Other"] as const;

export const TICKET_STATUSES = [["TODO", "To do"], ["IN_PROGRESS", "In progress"], ["IN_REVIEW", "In review"], ["DONE", "Done"]] as const;
export const PRIORITIES = [["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"], ["URGENT", "Urgent"]] as const;
export const CLIENT_STAGES = [["ONBOARDING", "Onboarding"], ["ACTIVE", "Active"], ["CLOSING", "Closing"], ["CLOSED", "Closed"]] as const;
export const DEAL_STAGES = [["LEAD", "Lead"], ["CONTACTED", "Contacted"], ["PROPOSAL", "Proposal sent"], ["NEGOTIATION", "Negotiation"], ["WON", "Won"], ["LOST", "Lost"]] as const;

export const LOST_REASONS = [
  ["price", "Price too high"],
  ["budget", "No budget"],
  ["timing", "Timing / not ready"],
  ["competitor", "Went with another agency"],
  ["noreply", "Stopped responding"],
  ["scope", "Not a fit for our services"],
  ["other", "Other"],
] as const;
export type LostReason = (typeof LOST_REASONS)[number][0];

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

export const DOCUMENT_STATUSES = [
  ["DRAFT", "Draft"],
  ["OUT_FOR_SIGNATURE", "Out for signature"],
  ["COMPLETED", "Completed"],
  ["VOIDED", "Voided"],
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number][0];

/** Field types a signer fills. Default sizes are in PDF points (1/72 inch). */
export const FIELD_TYPES = [
  ["SIGNATURE", "Signature", 170, 48],
  ["INITIALS", "Initials", 64, 40],
  ["DATE", "Date signed", 100, 20],
  ["NAME", "Full name", 160, 20],
  ["TEXT", "Text", 170, 20],
] as const;
export type FieldType = (typeof FIELD_TYPES)[number][0];

export const PROJECT_CATEGORIES = [
  ["WEBSITE", "Websites"],
  ["WEB_APP", "Web apps"],
  ["MOBILE_APP", "Mobile apps"],
  ["AI_AUTOMATION", "AI automations"],
  ["OTHER", "Other"],
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number][0];
/** Singular names, for a single project's tag. */
export const PROJECT_CATEGORY_ONE: Record<ProjectCategory, string> = {
  WEBSITE: "Website", WEB_APP: "Web app", MOBILE_APP: "Mobile app", AI_AUTOMATION: "AI automation", OTHER: "Other",
};
/** Link labels offered when adding a link (any other label can be typed). */
export const PROJECT_LINK_LABELS = ["Admin panel", "Staging", "App Store", "Google Play", "Dashboard", "Workflow", "API docs", "Repository", "Design (Figma)", "Documentation"];
