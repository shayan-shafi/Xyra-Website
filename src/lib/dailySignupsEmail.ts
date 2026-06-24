import type { DailySignupsData } from "./dailySignupsDigest";

function displayLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildDailySignupsSubject(data: DailySignupsData): string {
  return `Xyra Daily Signups — ${data.windowLabel}`;
}

// Plain text by design — this goes to a small internal recipient list and
// includes raw signup emails, so it intentionally skips any HTML template
// machinery (no public rendering surface, nothing to style).
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
