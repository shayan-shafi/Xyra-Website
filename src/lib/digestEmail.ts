import type { DigestData, DigestAction } from "@/lib/analyticsDigest";

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function bar(pctVal: number, color = "#0f0f0f"): string {
  const w = Math.min(100, Math.max(0, Math.round(pctVal)));
  const empty = 100 - w;
  if (w === 0) {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td height="5" style="background:#e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  }
  if (w === 100) {
    return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td height="5" style="background:${color};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="${w}%" height="5" style="background:${color};font-size:0;line-height:0;">&nbsp;</td><td width="${empty}%" height="5" style="background:#e5e7eb;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

function statCell(label: string, value: string, sub?: string): string {
  return `
    <td style="padding:14px 12px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;vertical-align:top;">
      <div style="font-size:26px;font-weight:700;color:#0f0f0f;line-height:1;">${esc(value)}</div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;">${esc(label)}</div>
      ${sub ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">${esc(sub)}</div>` : ""}
    </td>`;
}

function section(title: string, body: string): string {
  return `
    <tr><td style="padding-top:28px;padding-bottom:4px;">
      <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">${esc(title)}</p>
    </td></tr>
    <tr><td>${body}</td></tr>`;
}

function tagStyle(tag: DigestAction["tag"]): string {
  const map: Record<DigestAction["tag"], string> = {
    Fix: "background:#fee2e2;color:#b91c1c;",
    Watch: "background:#fef3c7;color:#92400e;",
    "Double down": "background:#dcfce7;color:#166534;",
    Promising: "background:#dbeafe;color:#1e40af;",
  };
  return map[tag] ?? "";
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildDigestHtml(data: DigestData): string {
  const { period, trackingStartDate, summary, funnel, sources, topSources, topCampaigns, referrals, ctas, sections, scrollDepth, featureCards, survey, actions } = data;

  const periodStr = `${fmtDate(period.start)} – ${fmtDate(period.end)}`;

  const trackingDateLabel = trackingStartDate
    ? new Date(trackingStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const showTrackingNote = summary.legacySignups > 0 || trackingStartDate !== null;

  // Tracking note (shown when legacy signups exist)
  const trackingNote = showTrackingNote ? `
    <tr><td style="padding-top:20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-left:3px solid #f59e0b;background:#fffbeb;">
        <tr>
          <td style="padding:10px 14px;font-size:12px;color:#92400e;line-height:1.5;">
            Conversion rates include only tracked signups (visitor_id present${trackingDateLabel ? `, after ${esc(trackingDateLabel)}` : ""}).
            ${summary.legacySignups > 0 ? `<strong>${summary.legacySignups} pre-tracking signup${summary.legacySignups === 1 ? "" : "s"}</strong> excluded from conversion calculations.` : ""}
          </td>
        </tr>
      </table>
    </td></tr>` : "";

  // Summary row 1: visitors, sessions, tracked signups, conversion, survey rate
  const summaryRow1 = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:2px;">
      <tr>
        ${statCell("Visitors", summary.uniqueVisitors.toLocaleString())}
        ${statCell("Sessions", summary.totalSessions.toLocaleString())}
        ${statCell("Tracked signups", summary.successfulSignups.toLocaleString(), summary.legacySignups > 0 ? `+${summary.legacySignups} pre-tracking` : undefined)}
        ${statCell("Conversion", `${summary.conversionRate}%`, "tracked visitors→signup")}
        ${statCell("Survey rate", `${summary.surveyCompletionRate}%`, "tracked signups→survey")}
      </tr>
    </table>`;

  // Summary row 2: CTA clickers, waitlist views, email submits, survey, skips
  const summaryRow2 = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        ${statCell("CTA clicks", summary.ctaClickers.toLocaleString())}
        ${statCell("Waitlist views", summary.waitlistViewers.toLocaleString())}
        ${statCell("Email submits", summary.emailSubmitters.toLocaleString())}
        ${statCell("Survey submits", summary.surveySubmitters.toLocaleString())}
        ${statCell("Survey skips", summary.surveySkippers.toLocaleString())}
      </tr>
    </table>`;

  // Funnel
  const funnelBody = funnel.map((step, i) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#374151;font-weight:${i === 0 ? "600" : "400"};width:40%;">${esc(step.step)}</td>
            <td style="font-size:14px;font-weight:600;color:#0f0f0f;text-align:right;width:60px;">${step.count.toLocaleString()}</td>
            <td style="font-size:11px;color:#9ca3af;text-align:right;padding-right:12px;width:60px;">${i > 0 ? `${step.pctOfPrev}% of prev` : ""}</td>
            <td style="width:120px;vertical-align:middle;">${bar(i === 0 ? 100 : step.pctOfPrev)}</td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  // Sources table
  const sourcesBody = sources.length === 0
    ? `<p style="margin:8px 0;font-size:13px;color:#9ca3af;font-style:italic;">No source data for this period.</p>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Source</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Med.</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Visitors</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Signups</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Conv.</td>
        </tr>
        ${sources.map(s => `
        <tr style="border-bottom:1px solid #f9fafb;">
          <td style="font-size:13px;font-weight:500;color:#111827;padding:7px 0;">${esc(s.source)}</td>
          <td style="font-size:12px;color:#6b7280;text-align:right;padding:7px 0 7px 8px;">${esc(s.medium ?? "—")}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;">${s.visitors.toLocaleString()}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;">${s.signups.toLocaleString()}</td>
          <td style="font-size:13px;font-weight:600;color:${s.conversionRate > 15 ? "#16a34a" : s.conversionRate > 5 ? "#d97706" : "#374151"};text-align:right;padding:7px 0 7px 8px;">${s.conversionRate}%</td>
        </tr>`).join("")}
      </table>`;

  // Top Campaigns / Marketing Performance — source totals first (so "Instagram
  // overall" is visible without summing rows), then the campaign/content
  // breakdown grouped by marketing identity (source + medium + campaign +
  // content + ref code), capped to the top rows by signups so the email
  // stays a summary rather than a raw data dump.
  const topSourcesBody = topSources.length === 0
    ? `<p style="margin:8px 0;font-size:13px;color:#9ca3af;font-style:italic;">No source data for this period.</p>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Source</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Visitors</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Signups</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Conv.</td>
        </tr>
        ${topSources.map(s => `
        <tr style="border-bottom:1px solid #f9fafb;">
          <td style="font-size:13px;font-weight:600;color:#111827;padding:7px 0;text-transform:capitalize;">${esc(s.source)}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;">${s.visitors.toLocaleString()}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;">${s.signups.toLocaleString()}</td>
          <td style="font-size:13px;font-weight:600;color:${s.conversionRate > 15 ? "#16a34a" : s.conversionRate > 5 ? "#d97706" : "#374151"};text-align:right;padding:7px 0 7px 8px;">${s.conversionRate}%</td>
        </tr>`).join("")}
      </table>`;

  // Referral-code traffic with no stronger UTM source shouldn't read as plain
  // "direct" in the email — see marketingSourceLabel in page.tsx for the same
  // rule on the dashboard.
  const campaignLabel = (c: { source: string; medium: string | null; campaign: string | null; content: string | null; refCode: string | null }) => {
    const sourceLabel = c.source === "direct" && c.refCode ? "Referral" : c.source;
    return c.medium || c.campaign || c.content
      ? [sourceLabel, c.medium, c.campaign, c.content].filter(Boolean).join(" / ")
      : sourceLabel;
  };
  const topCampaignsBody = topCampaigns.length === 0
    ? `<p style="margin:8px 0;font-size:13px;color:#9ca3af;font-style:italic;">No campaign data for this period.</p>`
    : `<p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;">Campaign / Content Breakdown</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Campaign</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Visitors</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Signups</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Conv.</td>
        </tr>
        ${topCampaigns.map(c => `
        <tr style="border-bottom:1px solid #f9fafb;">
          <td style="font-size:13px;font-weight:500;color:#111827;padding:7px 8px 7px 0;word-break:break-word;">${esc(campaignLabel(c))}${c.refCode ? `<div style="font-size:11px;color:#9ca3af;margin-top:1px;">ref: ${esc(c.refCode)}</div>` : ""}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;white-space:nowrap;">${c.visitors.toLocaleString()}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;white-space:nowrap;">${c.signups.toLocaleString()}</td>
          <td style="font-size:13px;font-weight:600;color:${c.conversionRate > 15 ? "#16a34a" : c.conversionRate > 5 ? "#d97706" : "#374151"};text-align:right;padding:7px 0 7px 8px;white-space:nowrap;">${c.conversionRate}%</td>
        </tr>`).join("")}
      </table>
      <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
        Exact post-level attribution only works when that post/ad/link used a unique UTM or referral code — posts sharing the same link collapse into one row above. Some signups counted in source totals above aren't shown in this breakdown because their converting visit was never tracked (ad blocker, private browsing, or a first touch outside this window).
      </p>`;

  // Referral Performance — only rendered when referral-code activity exists
  // in this window. This is a MARKETING-attribution view, attributed the
  // same way as the campaign breakdown above (converting session's ref code,
  // falling back to first-touch only when no conversion event was tracked).
  // It is NOT the app's actual referral reward/leaderboard logic — real
  // referral_count credit is keyed primarily off the visitor's
  // first-ever-touch ref code (see src/app/api/waitlist/route.ts), so the
  // two can disagree for a visitor who clicks a different referral link on
  // a later visit before signing up.
  const referralsBody = referrals.length === 0
    ? ""
    : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Ref Code</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Visitors</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Attributed</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Conv.</td>
        </tr>
        ${referrals.map(r => `
        <tr style="border-bottom:1px solid #f9fafb;">
          <td style="font-size:13px;font-weight:600;color:#111827;font-family:monospace;padding:7px 0;">${esc(r.refCode)}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;">${r.visitors.toLocaleString()}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;">${r.attributedSignups.toLocaleString()}</td>
          <td style="font-size:13px;font-weight:600;text-align:right;padding:7px 0 7px 8px;color:${r.conversionRate === null ? "#d97706" : r.conversionRate > 15 ? "#16a34a" : r.conversionRate > 5 ? "#d97706" : "#374151"};">${esc(r.conversionLabel)}</td>
        </tr>`).join("")}
      </table>
      <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
        Marketing attribution, not the app&#39;s referral reward logic — &quot;Attributed&quot; credits whichever ref code was active in the session that converted (matching the campaign breakdown above), falling back to first-touch only when that session wasn&#39;t tracked. The actual referral reward/leaderboard credit is keyed primarily off the visitor&#39;s first-ever-touch ref code instead, so the two can disagree. If a signup is attributed to a ref code but the matching visit/session is missing, conversion may be approximate or unavailable.
      </p>`;

  // CTA table
  const ctaBody = ctas.length === 0
    ? `<p style="margin:8px 0;font-size:13px;color:#9ca3af;font-style:italic;">No CTA click data for this period.</p>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Location</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Label</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Clicks</td>
          <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;text-align:right;">Uniq.</td>
        </tr>
        ${ctas.map(c => `
        <tr style="border-bottom:1px solid #f9fafb;">
          <td style="font-size:11px;color:#9ca3af;padding:7px 0;">${esc(c.location)}</td>
          <td style="font-size:13px;font-weight:500;color:#111827;padding:7px 8px;">${esc(c.label)}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0;">${c.clicks}</td>
          <td style="font-size:13px;color:#374151;text-align:right;padding:7px 0 7px 8px;">${c.uniqueClickers}</td>
        </tr>`).join("")}
      </table>`;

  // Section + Scroll side by side
  const sectionRows = sections.map(s => `
    <tr>
      <td style="font-size:12px;color:#374151;padding:5px 0 2px;text-transform:capitalize;">${esc(s.section)}</td>
      <td style="font-size:12px;font-weight:600;color:#0f0f0f;text-align:right;padding:5px 0 2px;padding-left:8px;white-space:nowrap;">${s.pctOfSessions}%</td>
    </tr>
    <tr>
      <td colspan="2" style="padding-bottom:5px;">${bar(s.pctOfSessions)}</td>
    </tr>`).join("");

  const scrollRows = scrollDepth.map(s => {
    const color = s.pctOfSessions > 60 ? "#16a34a" : s.pctOfSessions > 30 ? "#d97706" : "#dc2626";
    return `
    <tr>
      <td style="font-size:12px;color:#374151;padding:5px 0 2px;">${s.threshold}% scrolled</td>
      <td style="font-size:12px;font-weight:600;color:#0f0f0f;text-align:right;padding:5px 0 2px;padding-left:8px;white-space:nowrap;">${s.pctOfSessions}%</td>
    </tr>
    <tr>
      <td colspan="2" style="padding-bottom:5px;">${bar(s.pctOfSessions, color)}</td>
    </tr>`;
  }).join("");

  const engagementBody = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td width="48%" style="vertical-align:top;padding-right:16px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#374151;">Section reach</p>
          <table width="100%" cellpadding="0" cellspacing="0">${sectionRows}</table>
        </td>
        <td width="4%"></td>
        <td width="48%" style="vertical-align:top;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#374151;">Scroll depth</p>
          <table width="100%" cellpadding="0" cellspacing="0">${scrollRows}</table>
        </td>
      </tr>
    </table>`;

  // Feature cards
  const maxCardClicks = featureCards[0]?.clicks ?? 1;
  const cardsBody = featureCards.length === 0
    ? `<p style="margin:8px 0;font-size:13px;color:#9ca3af;font-style:italic;">No feature card clicks recorded.</p>`
    : featureCards.map(c => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="font-size:13px;color:#374151;text-transform:capitalize;font-weight:500;">${esc(c.card)}</td>
          <td style="font-size:12px;color:#6b7280;text-align:right;white-space:nowrap;">${c.uniqueClickers} uniq · ${c.clicks} clicks</td>
        </tr>
        <tr><td colspan="2" style="padding-top:4px;">${bar((c.clicks / maxCardClicks) * 100)}</td></tr>
      </table>`).join("");

  // Survey
  const surveyBody = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px;">
      <tr>
        ${statCell("Signups", survey.signups.toLocaleString())}
        ${statCell("Submitted", survey.submits.toLocaleString())}
        ${statCell("Skipped", survey.skips.toLocaleString())}
        ${statCell("Completion", `${survey.completionRate}%`)}
        ${statCell("Skip rate", `${survey.skipRate}%`)}
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
      <tr>
        <td style="font-size:12px;color:#374151;padding-bottom:4px;">Completion</td>
        <td style="font-size:12px;font-weight:600;text-align:right;padding-bottom:4px;color:#0f0f0f;">${survey.completionRate}%</td>
      </tr>
      <tr><td colspan="2">${bar(survey.completionRate, "#16a34a")}</td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;color:#374151;padding:6px 0 4px;">Skip rate</td>
        <td style="font-size:12px;font-weight:600;text-align:right;padding:6px 0 4px;color:#0f0f0f;">${survey.skipRate}%</td>
      </tr>
      <tr><td colspan="2">${bar(survey.skipRate, "#d97706")}</td></tr>
    </table>`;

  // Actions
  const actionsBody = actions.length === 0
    ? `<p style="margin:8px 0;font-size:13px;color:#9ca3af;font-style:italic;">Not enough data to surface recommendations.</p>`
    : actions.map(a => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="vertical-align:top;padding-right:10px;width:1%;white-space:nowrap;">
            <span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;${tagStyle(a.tag)}">${esc(a.tag)}</span>
          </td>
          <td style="font-size:13px;color:#374151;vertical-align:top;line-height:1.5;">${esc(a.message)}</td>
        </tr>
      </table>`).join("");

  // ── Full email HTML ───────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Xyra Analytics Digest</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#0f0f0f;padding:24px 32px;border-radius:12px 12px 0 0;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Xyra Analytics Digest</p>
              <p style="margin:5px 0 0;font-size:12px;color:#9ca3af;">${esc(periodStr)} &nbsp;·&nbsp; Last ${period.days} days &nbsp;·&nbsp; Internal only</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px 36px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Summary -->
                ${section("Summary", summaryRow1 + summaryRow2)}

                <!-- Tracking note -->
                ${trackingNote}

                <!-- Funnel -->
                ${section("Conversion Funnel", `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${funnelBody}</table>`)}

                <!-- Sources -->
                ${section("Traffic Sources", sourcesBody)}

                <!-- Top Campaigns -->
                ${section("Top Campaigns", topSourcesBody + `<div style="margin-top:18px;">${topCampaignsBody}</div>`)}

                <!-- Referral Performance (only when referral-code activity exists) -->
                ${referrals.length > 0 ? section("Referral Performance", referralsBody) : ""}

                <!-- CTAs -->
                ${section("CTA Performance", ctaBody)}

                <!-- Engagement -->
                ${section("Section & Scroll Engagement", engagementBody)}

                <!-- Feature cards -->
                ${section("Feature Card Engagement", cardsBody)}

                <!-- Survey -->
                ${section("Survey Completion", surveyBody)}

                <!-- Actions -->
                ${section("Recommended Actions", actionsBody)}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                This digest is sent every ${period.days} days · Xyra first-party analytics · Internal use only
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildDigestSubject(data: DigestData): string {
  const { period } = data;
  const start = period.start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const end = period.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `Xyra Analytics Digest — ${start} – ${end}`;
}
