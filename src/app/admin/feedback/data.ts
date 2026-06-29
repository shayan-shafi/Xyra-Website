import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";

// Data layer for the admin Feedback dashboard. Reads from the XYRA APP Supabase
// project (service role) — in-app feedback tickets + the connector/reminder
// wishlists we collect while those features are pre-launch. Read-only.

export interface FeedbackTicket {
  id: string;
  type: "bug" | "idea" | "other";
  status: "open" | "triaged" | "resolved" | "wontfix";
  message: string;
  dashboardTitle: string | null;
  dashboardType: string | null;
  appVersion: string | null;
  email: string | null;
  createdAt: string;
  replyCount: number;
  lastSender: "user" | "team" | null;
}

export interface DemandRow {
  label: string;
  wants: number;
}

export interface CustomRequestRow {
  label: string;
  reason: string | null;
  email: string | null;
  createdAt: string;
}

export interface IdeaRow {
  label: string;
  email: string | null;
  createdAt: string;
}

export interface FeedbackData {
  counts: {
    openTickets: number;
    totalTickets: number;
    connectorHearts: number;
    reminderVotes: number;
    ideas: number;
  };
  tickets: FeedbackTicket[];
  connectorDemand: DemandRow[];
  connectorRequests: CustomRequestRow[];
  reminderDemand: DemandRow[];
  reminderIdeas: IdeaRow[];
}

// Map of reminder capability key → friendly label (mirrors the app's Reminders
// page). Falls back to the raw key for anything we don't recognize.
const REMINDER_TYPE_LABELS: Record<string, string> = {
  voice_remind: 'Say "remind me to…"',
  auto_dated: "Auto-remind dated items",
  daily_nudge: "Daily nudges",
  conversational: "Conversational pokes",
};

/** Best-effort user_id → email map via the auth admin API (alpha-scale: one page). */
async function buildEmailMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabaseAppAdmin) return map;
  try {
    const { data } = await supabaseAppAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) {
      if (u.email) map.set(u.id, u.email);
    }
  } catch {
    // Non-fatal — the dashboard just shows truncated ids instead of emails.
  }
  return map;
}

export async function fetchFeedbackData(): Promise<FeedbackData | null> {
  if (!supabaseAppAdmin) return null;
  const db = supabaseAppAdmin;

  const [
    emailMap,
    { data: feedbackRows },
    { data: messageRows },
    { data: connectorRows },
    { data: reminderRows },
  ] = await Promise.all([
    buildEmailMap(),
    db
      .from("feedback")
      .select("id, user_id, type, status, message, dashboard_title, dashboard_type, app_version, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    db
      .from("feedback_messages")
      .select("feedback_id, sender, created_at")
      .order("created_at", { ascending: true })
      .limit(5000),
    db
      .from("connector_wishlist")
      .select("user_id, connector, is_custom, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    db
      .from("reminder_wishlist")
      .select("user_id, kind, label, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const emailOf = (userId: string): string | null =>
    emailMap.get(userId) ?? (userId ? `${userId.slice(0, 8)}…` : null);

  // Thread stats per ticket.
  const replyCount = new Map<string, number>();
  const lastSender = new Map<string, "user" | "team">();
  for (const m of messageRows ?? []) {
    replyCount.set(m.feedback_id, (replyCount.get(m.feedback_id) ?? 0) + 1);
    lastSender.set(m.feedback_id, m.sender);
  }

  const tickets: FeedbackTicket[] = (feedbackRows ?? []).map((f) => ({
    id: f.id,
    type: f.type,
    status: f.status,
    message: f.message,
    dashboardTitle: f.dashboard_title,
    dashboardType: f.dashboard_type,
    appVersion: f.app_version,
    email: emailOf(f.user_id),
    createdAt: f.created_at,
    replyCount: replyCount.get(f.id) ?? 0,
    lastSender: lastSender.get(f.id) ?? null,
  }));

  // Connector demand (hearts on listed connectors) + custom requests.
  const connectorWants = new Map<string, number>();
  const connectorRequests: CustomRequestRow[] = [];
  let connectorHearts = 0;
  for (const r of connectorRows ?? []) {
    if (r.is_custom) {
      connectorRequests.push({
        label: r.connector,
        reason: r.reason,
        email: emailOf(r.user_id),
        createdAt: r.created_at,
      });
    } else {
      connectorHearts += 1;
      connectorWants.set(r.connector, (connectorWants.get(r.connector) ?? 0) + 1);
    }
  }

  // Reminder demand (type hearts) + free-text ideas.
  const reminderWants = new Map<string, number>();
  const reminderIdeas: IdeaRow[] = [];
  let reminderVotes = 0;
  for (const r of reminderRows ?? []) {
    if (r.kind === "idea") {
      reminderIdeas.push({ label: r.label, email: emailOf(r.user_id), createdAt: r.created_at });
    } else {
      reminderVotes += 1;
      const label = REMINDER_TYPE_LABELS[r.label] ?? r.label;
      reminderWants.set(label, (reminderWants.get(label) ?? 0) + 1);
    }
  }

  const toDemand = (m: Map<string, number>): DemandRow[] =>
    Array.from(m.entries())
      .map(([label, wants]) => ({ label, wants }))
      .sort((a, b) => b.wants - a.wants);

  return {
    counts: {
      openTickets: tickets.filter((t) => t.status === "open").length,
      totalTickets: tickets.length,
      connectorHearts,
      reminderVotes,
      ideas: reminderIdeas.length + connectorRequests.length,
    },
    tickets,
    connectorDemand: toDemand(connectorWants),
    connectorRequests,
    reminderDemand: toDemand(reminderWants),
    reminderIdeas,
  };
}
