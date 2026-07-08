// DTOs shared between the recipient-groups API routes and the client UI.

export type GroupMember = {
  email: string;
  name: string | null;
  notes: string | null;
  source: string | null;
};

export type GroupSummary = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  lastUsedAt: string | null;
  memberCount: number;
};

export type GroupDetail = GroupSummary & { members: GroupMember[] };

// One reusable campaign from the send log (no emails — counts only).
export type CampaignSummary = {
  campaignKey: string;
  templateId: string;
  recipientCount: number;
  lastSentAt: string | null;
};
