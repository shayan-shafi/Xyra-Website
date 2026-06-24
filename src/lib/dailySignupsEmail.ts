import type { DailySignupsData } from "./dailySignupsDigest";

function displayLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildDailySignupsSubject(data: DailySignupsData): string {
  return `Xyra Daily Signups — ${data.windowLabel}`;
}

// Plain text by design — this goes to a small internal recipient list and
// includes raw signup emails, so it intentionally skips any HTML template
// machinery (no public rendering surface, nothing to style). Sent alongside
// buildDailySignupsHtml as the fallback for clients that don't render HTML.
export function buildDailySignupsText(data: DailySignupsData): string {
  const lines: string[] = [];

  lines.push(`Xyra Daily Signups — ${data.windowLabel}`);
  lines.push("");
  lines.push(`New signups yesterday: ${data.newSignups}`);
  lines.push(`Total waitlist: ${data.totalWaitlist}`);
  lines.push("");

  lines.push("Sources:");
  if (data.bySource.length === 0) {
    lines.push("- (none)");
  } else {
    for (const s of data.bySource) lines.push(`- ${displayLabel(s.source)}: ${s.count}`);
  }
  lines.push("");

  lines.push("Campaigns:");
  if (data.byCampaign.length === 0) {
    lines.push("- (none)");
  } else {
    for (const c of data.byCampaign) lines.push(`- ${c.label}: ${c.count}`);
  }
  lines.push("");

  lines.push("Referral codes:");
  if (data.byRefCode.length === 0) {
    lines.push("- (none)");
  } else {
    for (const r of data.byRefCode) lines.push(`- ${r.code}: ${r.count}`);
  }
  lines.push("");

  lines.push("New signups:");
  if (data.signups.length === 0) {
    lines.push("- (none)");
  } else {
    for (const s of data.signups) {
      const attribution = s.campaignLabel ?? displayLabel(s.source);
      lines.push(`- ${s.email} — ${attribution}`);
    }
  }
  lines.push("");

  lines.push("Notes:");
  if (data.unknownCount > 0) {
    lines.push(`- ${data.unknownCount} signup${data.unknownCount === 1 ? "" : "s"} had missing attribution.`);
  } else {
    lines.push("- No signups with missing attribution.");
  }

  return lines.join("\n");
}

// ── HTML builder ───────────────────────────────────────────────────────────────
//
// Deliberately mirrors the visual language of buildDigestHtml in
// digestEmail.ts (same dark header bar, white card body, bordered stat
// cells, muted-uppercase section headers, thin progress bars, table-based
// layout for email-client compatibility) so the two digests read as part of
// the same product, without sharing code — digestEmail.ts is left untouched.

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

// `wrap: true` is used for text-heavy stat values (a source/campaign label)
// instead of a short number, so long values shrink and wrap rather than
// overflowing the cell.
function statCell(label: string, value: string, opts?: { sub?: string; wrap?: boolean }): string {
  const valueStyle = opts?.wrap
    ? "font-size:14px;font-weight:700;color:#0f0f0f;line-height:1.3;word-break:break-word;overflow-wrap:anywhere;"
    : "font-size:26px;font-weight:700;color:#0f0f0f;line-height:1;";
  return `
    <td style="padding:14px 10px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center;vertical-align:top;">
      <div style="${valueStyle}">${esc(value)}</div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;">${esc(label)}</div>
      ${opts?.sub ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">${esc(opts.sub)}</div>` : ""}
    </td>`;
}

function section(title: string, body: string): string {
  return `
    <tr><td style="padding-top:28px;padding-bottom:4px;">
      <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">${esc(title)}</p>
    </td></tr>
    <tr><td>${body}</td></tr>`;
}

function emptyState(message: string): string {
  return `<p style="margin:8px 0;font-size:13px;color:#9ca3af;font-style:italic;">${esc(message)}</p>`;
}

// Row + bar pattern (label, count, share-of-total bar) shared by the
// Sources / Campaigns / Referral codes sections. `wrapLabel` lets long
// campaign tuples wrap instead of overflowing.
function countRows(rows: { label: string; count: number }[], total: number, wrapLabel = false): string {
  return rows
    .map(r => {
      const pct = total > 0 ? (r.count / total) * 100 : 0;
      const labelStyle = wrapLabel
        ? "font-size:13px;color:#374151;padding:6px 0 2px;word-break:break-word;overflow-wrap:anywhere;"
        : "font-size:13px;color:#374151;padding:6px 0 2px;";
      return `
        <tr>
          <td style="${labelStyle}">${esc(r.label)}</td>
          <td style="font-size:13px;font-weight:600;color:#0f0f0f;text-align:right;padding:6px 0 2px;padding-left:10px;white-space:nowrap;vertical-align:top;">${r.count.toLocaleString()}</td>
        </tr>
        <tr><td colspan="2" style="padding-bottom:6px;">${bar(pct)}</td></tr>`;
    })
    .join("");
}

export function buildDailySignupsHtml(data: DailySignupsData): string {
  const { windowLabel, newSignups, totalWaitlist, bySource, byCampaign, byRefCode, signups, unknownCount } = data;

  const topSource = bySource[0];
  const topCampaign = byCampaign[0];
  const referralSignups = byRefCode.filter(r => r.code !== "none").reduce((sum, r) => sum + r.count, 0);
  const topRefCode = byRefCode.find(r => r.code !== "none");

  // Summary stat row — new signups, total waitlist, top source, top campaign
  // (if available), referral signups (if available).
  const summaryRow = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        ${statCell("New signups", newSignups.toLocaleString(), { sub: "yesterday" })}
        ${statCell("Total waitlist", totalWaitlist.toLocaleString())}
        ${
          topSource
            ? statCell("Top source", displayLabel(topSource.source), { sub: `${topSource.count} signup${topSource.count === 1 ? "" : "s"}`, wrap: true })
            : statCell("Top source", "—")
        }
        ${
          topCampaign
            ? statCell("Top campaign", topCampaign.label, { sub: `${topCampaign.count} signup${topCampaign.count === 1 ? "" : "s"}`, wrap: true })
            : statCell("Top campaign", "—", { sub: "no campaign data" })
        }
        ${
          referralSignups > 0
            ? statCell("Referral signups", referralSignups.toLocaleString(), { sub: topRefCode ? `top: ${topRefCode.code}` : undefined })
            : statCell("Referral signups", "0", { sub: "no referral codes" })
        }
      </tr>
    </table>`;

  const sourcesBody =
    bySource.length === 0
      ? emptyState("No signups for this period.")
      : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${countRows(
          bySource.map(s => ({ label: displayLabel(s.source), count: s.count })),
          newSignups
        )}</table>`;

  const campaignsBody =
    byCampaign.length === 0
      ? emptyState("No campaign/session data for this period.")
      : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${countRows(
          byCampaign.map(c => ({ label: c.label, count: c.count })),
          newSignups,
          true
        )}</table>`;

  const referralsBody =
    byRefCode.length === 0
      ? emptyState("No referral code data for this period.")
      : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${countRows(
          byRefCode.map(r => ({ label: r.code, count: r.count })),
          newSignups
        )}</table>`;

  // New signups table — kept as a real table (not a bullet list) with the
  // email column allowed to break anywhere (no spaces to wrap at) and the
  // attribution column wrapping at word boundaries.
  const signupsBody =
    signups.length === 0
      ? emptyState("No new signups for this period.")
      : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Email</td>
            <td style="font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;padding:0 0 6px;">Attribution</td>
          </tr>
          ${signups
            .map(
              s => `
          <tr style="border-bottom:1px solid #f9fafb;">
            <td style="font-size:13px;color:#111827;padding:7px 10px 7px 0;word-break:break-all;overflow-wrap:anywhere;vertical-align:top;">${esc(s.email)}</td>
            <td style="font-size:13px;color:#374151;padding:7px 0;word-break:break-word;overflow-wrap:anywhere;vertical-align:top;">${esc(s.campaignLabel ?? displayLabel(s.source))}</td>
          </tr>`
            )
            .join("")}
        </table>`;

  const notesBody =
    unknownCount > 0
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-left:3px solid #f59e0b;background:#fffbeb;">
          <tr>
            <td style="padding:10px 14px;font-size:12px;color:#92400e;line-height:1.5;">
              <strong>${unknownCount} signup${unknownCount === 1 ? "" : "s"}</strong> had missing attribution (no visitor/tracking data captured).
            </td>
          </tr>
        </table>`
      : emptyState("No signups with missing attribution.");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Xyra Daily Signups</title>
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
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Xyra Daily Signups</p>
              <p style="margin:5px 0 0;font-size:12px;color:#9ca3af;">${esc(windowLabel)} &nbsp;·&nbsp; Internal only</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px 36px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

                <!-- Summary -->
                ${section("Summary", summaryRow)}

                <!-- Sources -->
                ${section("Sources", sourcesBody)}

                <!-- Campaigns -->
                ${section("Campaigns", campaignsBody)}

                <!-- Referral codes -->
                ${section("Referral Codes", referralsBody)}

                <!-- New signups -->
                ${section("New Signups", signupsBody)}

                <!-- Notes -->
                ${section("Notes", notesBody)}

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
                Sent daily for the prior day (America/Chicago) · Xyra first-party analytics · Internal use only
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
