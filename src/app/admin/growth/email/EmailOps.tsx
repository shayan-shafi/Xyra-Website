"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  GROWTH_TEMPLATES,
  getGrowthTemplate,
  defaultValues,
  defaultSubject,
  defaultSections,
  resolveSections,
  missingPlaceholders,
  parseGallery,
  serializeGallery,
  PER_RECIPIENT_KEYS,
  type PlaceholderDef,
  type GalleryImage,
} from "@/lib/growthEmailTemplates";

const RECIPIENTS_KEY = "xyra_growth_recipients";
const draftKey = (id: string) => `xyra_email_draft_${id}`;

export type RecentRun = { campaignKey: string; templateId: string; subject: string; count: number; at: string };

type StagedRecipient = { name: string | null; email: string; refCode: string | null };
type Draft = { subject: string; values: Record<string, string>; sections: Record<string, boolean> };
type DryRunResult = {
  counts: { requested: number; valid: number; willSend: number; skippedDuplicate: number; skippedUnknown: number; skippedInvalid: number; placeholderName: number };
  willSend: string[];
  skippedDuplicate: string[];
  skippedUnknown: string[];
  skippedInvalid: string[];
  placeholderNameRecipients: string[];
  missingGlobals?: string[];
  dryRunToken?: string;
};

function isPerRecipient(key: string): boolean {
  return (PER_RECIPIENT_KEYS as readonly string[]).includes(key);
}

function codeDraft(id: string): Draft {
  const tpl = getGrowthTemplate(id)!;
  return { subject: defaultSubject(tpl), values: defaultValues(tpl), sections: defaultSections(tpl) };
}

// ── Drag-and-drop image field ───────────────────────────────────────────────
function ImageField({
  value,
  onChange,
  ready,
}: {
  value: string;
  onChange: (url: string) => void;
  ready: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/admin/growth/email/upload-image", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.url) onChange(json.url);
      else setErr(json.error ?? `Upload failed (${res.status})`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }, [upload]);

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white";

  return (
    <div>
      {ready ? (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${drag ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}
        >
          {uploading ? (
            <p className="text-sm text-gray-500">Uploading…</p>
          ) : (
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">Drag &amp; drop</span> an image, or click to choose. PNG/JPG/WEBP/GIF, max 5&nbsp;MB.
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-snug">
          Image upload needs a one-time setup — create a public Supabase Storage bucket
          (<span className="font-mono">email-assets</span>, see <span className="font-mono">supabase/setup.sql §10</span>).
          Until then, paste a public HTTPS image URL below.
        </div>
      )}

      <input className={`${inputCls} mt-2`} value={value} onChange={e => onChange(e.target.value)} placeholder="https://… (public HTTPS image URL)" />
      <p className="text-[11px] text-gray-400 mt-1 leading-snug">Email images must be hosted at a public HTTPS URL — a local file from your computer will not load in an email.</p>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
      {value && /^https?:\/\//.test(value) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="preview" className="mt-2 max-h-32 rounded-lg border border-gray-200" />
      )}
    </div>
  );
}

// ── Multi-image gallery field ───────────────────────────────────────────────
// Upload one image at a time (or paste a public HTTPS URL) to build an ordered
// list. Each entry has optional alt text + caption, can be reordered or removed.
// The whole list serializes to a JSON string stored in one template value, so it
// persists through saved drafts (DB values_json or localStorage) with no schema
// change. The dropzone/placeholder lives here only — it never reaches the email.
function ImageGalleryField({
  value,
  onChange,
  ready,
}: {
  value: string;
  onChange: (v: string) => void;
  ready: boolean;
}) {
  const images = useMemo(() => parseGallery(value), [value]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Always re-parse from the latest `value` so concurrent edits never clobber.
  const commit = useCallback((next: GalleryImage[]) => onChange(serializeGallery(next)), [onChange]);
  const append = useCallback((img: GalleryImage) => onChange(serializeGallery([...parseGallery(value), img])), [onChange, value]);

  const upload = useCallback(async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/admin/growth/email/upload-image", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok && json.url) append({ url: json.url, alt: "", caption: "" });
      else setErr(json.error ?? `Upload failed (${res.status})`);
    } catch (e) {
      setErr(String(e));
    } finally {
      setUploading(false);
    }
  }, [append]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }, [upload]);

  const move = useCallback((i: number, dir: -1 | 1) => {
    const arr = parseGallery(value);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    commit(arr);
  }, [value, commit]);

  const removeAt = useCallback((i: number) => {
    const arr = parseGallery(value);
    arr.splice(i, 1);
    commit(arr);
  }, [value, commit]);

  const patch = useCallback((i: number, p: Partial<GalleryImage>) => {
    const arr = parseGallery(value);
    if (!arr[i]) return;
    arr[i] = { ...arr[i], ...p };
    commit(arr);
  }, [value, commit]);

  const addManual = useCallback(() => {
    const u = manualUrl.trim();
    if (!/^https?:\/\//i.test(u)) { setErr("Enter a public HTTPS image URL (starts with https://)."); return; }
    setErr(null);
    append({ url: u, alt: "", caption: "" });
    setManualUrl("");
  }, [manualUrl, append]);

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white";

  return (
    <div>
      {ready ? (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${drag ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}
        >
          {uploading ? (
            <p className="text-sm text-gray-500">Uploading…</p>
          ) : (
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">Drag &amp; drop</span> an image, or click to choose. PNG/JPG/WEBP/GIF, max 5&nbsp;MB. Add as many as you like, one at a time.
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); if (inputRef.current) inputRef.current.value = ""; }}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-snug">
          Image upload needs a one-time setup — create a public Supabase Storage bucket
          (<span className="font-mono">email-assets</span>, see <span className="font-mono">supabase/setup.sql §10</span>).
          Until then, paste public HTTPS image URLs below.
        </div>
      )}

      <div className="flex gap-2 mt-2">
        <input
          className={inputCls}
          value={manualUrl}
          onChange={e => setManualUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }}
          placeholder="https://… (public HTTPS image URL)"
        />
        <button type="button" onClick={addManual} className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Add</button>
      </div>
      <p className="text-[11px] text-gray-400 mt-1 leading-snug">Email images must be hosted at a public HTTPS URL — a local file from your computer will not load in an email.</p>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}

      {images.length > 0 && (
        <ul className="mt-3 space-y-3">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="flex gap-3 rounded-xl border border-gray-200 p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt || "preview"} className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 object-cover" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <input className={inputCls} value={img.alt} onChange={e => patch(i, { alt: e.target.value })} placeholder="Alt text (optional, for accessibility)" />
                <input className={inputCls} value={img.caption} onChange={e => patch(i, { caption: e.target.value })} placeholder="Caption (optional, shown under the image)" />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-2 py-0.5 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30" title="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="px-2 py-0.5 rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30" title="Move down">↓</button>
                <button type="button" onClick={() => removeAt(i)} className="px-2 py-0.5 rounded text-xs text-red-500 hover:bg-red-50" title="Remove">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length >= 2 && (
        <p className="text-[11px] text-gray-400 mt-2 leading-snug">Two images render side by side (stacking on mobile); three or more stack vertically.</p>
      )}
    </div>
  );
}

export default function EmailOps({
  sendsEnabled,
  hasInternalRecipients,
  internalRecipients,
  imageUploadReady,
  aiDraftReady,
  growthFromEmail,
  usingFallbackSender,
  recentRuns,
}: {
  sendsEnabled: boolean;
  hasInternalRecipients: boolean;
  internalRecipients: string[];
  imageUploadReady: boolean;
  aiDraftReady: boolean;
  growthFromEmail: string;
  usingFallbackSender: boolean;
  recentRuns: RecentRun[];
}) {
  const [templateId, setTemplateId] = useState(GROWTH_TEMPLATES[0].id);
  const tpl = getGrowthTemplate(templateId)!;

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(GROWTH_TEMPLATES.map(t => [t.id, codeDraft(t.id)]))
  );
  const draft = drafts[templateId];

  const [persistence, setPersistence] = useState<"db" | "local" | "unknown">("unknown");
  const [recipients, setRecipients] = useState<StagedRecipient[]>([]);
  const [campaignKey, setCampaignKey] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"html" | "text">("html");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  // Saved recipient groups (load into / save from the recipient list). Loading a
  // group only populates recipients — it never sends; the guarded send flow is
  // unchanged.
  const [groups, setGroups] = useState<{ id: number; name: string; memberCount: number }[]>([]);
  const [loadedGroupName, setLoadedGroupName] = useState<string | null>(null);
  const [showSaveGroup, setShowSaveGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RECIPIENTS_KEY);
      if (raw) setRecipients(JSON.parse(raw) as StagedRecipient[]);
    } catch { /* storage blocked */ }

    (async () => {
      const next: Record<string, Draft> = Object.fromEntries(GROWTH_TEMPLATES.map(t => [t.id, codeDraft(t.id)]));
      for (const t of GROWTH_TEMPLATES) {
        try {
          const raw = localStorage.getItem(draftKey(t.id));
          if (raw) {
            const p = JSON.parse(raw) as Partial<Draft>;
            next[t.id] = {
              subject: p.subject ?? next[t.id].subject,
              values: { ...next[t.id].values, ...(p.values ?? {}) },
              sections: { ...next[t.id].sections, ...(p.sections ?? {}) },
            };
          }
        } catch { /* ignore */ }
      }
      try {
        const res = await fetch("/admin/growth/email/template");
        if (!res.ok) {
          setPersistence("local");
        } else {
          const json = await res.json();
          setPersistence(json.persistence ? "db" : "local");
          if (json.overrides) {
            for (const [id, ov] of Object.entries(json.overrides as Record<string, Partial<Draft>>)) {
              if (next[id]) next[id] = {
                subject: ov.subject || next[id].subject,
                values: { ...next[id].values, ...(ov.values ?? {}) },
                sections: { ...next[id].sections, ...(ov.sections ?? {}) },
              };
            }
          }
        }
      } catch {
        setPersistence("local");
      }
      setDrafts(next);
    })();
  }, []);

  useEffect(() => { setDryRunResult(null); }, [templateId, campaignKey, recipients, draft]);
  // A campaign key only exists so nobody gets the same email twice. Suggest
  // one (template + today) instead of making the sender invent it.
  const suggestedKey = useMemo(() => `${templateId}-${new Date().toLocaleDateString("en-CA")}`, [templateId]);
  const effectiveKey = campaignKey.trim() || suggestedKey;

  const setSubject = useCallback((subject: string) => setDrafts(prev => ({ ...prev, [templateId]: { ...prev[templateId], subject } })), [templateId]);
  const setValue = useCallback((key: string, val: string) => setDrafts(prev => ({ ...prev, [templateId]: { ...prev[templateId], values: { ...prev[templateId].values, [key]: val } } })), [templateId]);
  const toggleSection = useCallback((key: string) => setDrafts(prev => ({ ...prev, [templateId]: { ...prev[templateId], sections: { ...prev[templateId].sections, [key]: !(prev[templateId].sections[key] !== false) } } })), [templateId]);

  const subject = draft.subject;
  const values = draft.values;
  const sections = useMemo(() => resolveSections(tpl, draft.sections), [tpl, draft.sections]);
  const html = useMemo(() => tpl.buildHtml(values, sections), [tpl, values, sections]);
  const text = useMemo(() => tpl.buildText(values, sections), [tpl, values, sections]);
  const missing = useMemo(() => missingPlaceholders(tpl, values, sections), [tpl, values, sections]);
  const subjectMissing = !subject.trim();
  const recipientEmails = useMemo(() => recipients.map(r => r.email), [recipients]);

  const sectionEnabled = useCallback((p: PlaceholderDef) => !p.section || sections[p.section] !== false, [sections]);

  const saveDraft = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try { localStorage.setItem(draftKey(templateId), JSON.stringify(draft)); } catch { /* ignore */ }
    try {
      const res = await fetch("/admin/growth/email/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, subject: draft.subject, values: draft.values, sections: draft.sections }),
      });
      const json = await res.json();
      if (res.ok) { setPersistence("db"); setMessage("Saved to the database — this draft will persist for everyone."); }
      else if (res.status === 409) { setPersistence("local"); setMessage("Saved to this browser. To persist in the database, apply supabase/setup.sql §9."); }
      else setMessage(`Save failed: ${json.error ?? res.status} (kept a local copy).`);
    } catch (e) {
      setMessage(`Saved locally only — server error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [templateId, draft]);

  const resetDraft = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try { localStorage.removeItem(draftKey(templateId)); } catch { /* ignore */ }
    try {
      await fetch("/admin/growth/email/template", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId }) });
    } catch { /* ignore */ }
    setDrafts(prev => ({ ...prev, [templateId]: codeDraft(templateId) }));
    setMessage("Reset to the built-in default.");
    setBusy(false);
  }, [templateId]);

  const generateDraft = useCallback(async () => {
    if (!aiPrompt.trim()) { setMessage("Describe what you want the email to say first."); return; }
    setAiBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/admin/growth/email/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, prompt: aiPrompt }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.setupNeeded ? json.error : `Draft failed: ${json.error ?? res.status}`);
        return;
      }
      // Merge AI draft over the current draft; admin edits everything after.
      setDrafts(prev => ({
        ...prev,
        [templateId]: {
          subject: json.subject || prev[templateId].subject,
          values: { ...prev[templateId].values, ...(json.values ?? {}) },
          sections: { ...prev[templateId].sections, ...(json.sections ?? {}) },
        },
      }));
      setMessage("Draft generated — review and edit every field before sending.");
    } catch (e) {
      setMessage(`Draft error: ${String(e)}`);
    } finally {
      setAiBusy(false);
    }
  }, [aiPrompt, templateId]);

  const testSend = useCallback(async () => {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/admin/growth/email/test-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, subject, values, sections: draft.sections }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(`Test send failed: ${json.error ?? res.status}`);
      else setMessage(`Test sent (internal only) to: ${(json.recipients ?? []).join(", ")}`);
    } catch (e) { setMessage(`Test send error: ${String(e)}`); } finally { setBusy(false); }
  }, [templateId, subject, values, draft.sections]);

  const runDry = useCallback(async () => {
    setBusy(true); setMessage(null); setDryRunResult(null);
    try {
      const res = await fetch("/admin/growth/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, subject, values, sections: draft.sections, recipients: recipientEmails, campaignKey: effectiveKey, dryRun: true }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(`Dry run failed: ${json.error ?? res.status}`);
      else { setDryRunResult(json as DryRunResult); setMessage(null); }
    } catch (e) { setMessage(`Dry run error: ${String(e)}`); } finally { setBusy(false); }
  }, [templateId, subject, values, draft.sections, recipientEmails, effectiveKey]);

  const realSend = useCallback(async () => {
    if (confirmText !== tpl.confirmPhrase) { setMessage(`Type "${tpl.confirmPhrase}" exactly to confirm.`); return; }
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/admin/growth/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, subject, values, sections: draft.sections, recipients: recipientEmails, campaignKey: effectiveKey, confirm: confirmText, dryRunToken: dryRunResult?.dryRunToken }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(`Send failed: ${json.error ?? res.status}`);
      else { setMessage(`Sent to ${json.counts.sent}${json.counts.failed ? `, ${json.counts.failed} failed` : ""}${json.counts.skippedDuplicate ? `, ${json.counts.skippedDuplicate} skipped (already had it)` : ""}${json.counts.skippedUnknown ? `, ${json.counts.skippedUnknown} skipped (not a xyra user)` : ""}. Refresh to see it under Past sends.`); setConfirmText(""); setDryRunResult(null); }
    } catch (e) { setMessage(`Send error: ${String(e)}`); } finally { setBusy(false); }
  }, [confirmText, tpl, templateId, subject, values, draft.sections, recipientEmails, effectiveKey, dryRunResult]);

  const clearRecipients = useCallback(() => {
    setRecipients([]);
    setLoadedGroupName(null);
    try { sessionStorage.removeItem(RECIPIENTS_KEY); } catch { /* ignore */ }
  }, []);

  const refreshGroups = useCallback(async () => {
    try {
      const res = await fetch("/admin/growth/email/recipient-groups");
      const json = await res.json();
      if (res.ok && !json.setupNeeded) {
        const gs = (json.groups ?? []) as { id: number; name: string; memberCount: number }[];
        setGroups(gs.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount })));
      }
    } catch { /* groups just won't show */ }
  }, []);

  useEffect(() => { void refreshGroups(); }, [refreshGroups]);

  // Load a saved group into the recipient list. This ONLY populates recipients —
  // it does not send. The admin still previews / dry-runs / confirms as usual.
  const loadGroup = useCallback(async (id: number) => {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(`/admin/growth/email/recipient-groups/${id}/use`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error ?? `Failed to load group (${res.status})`); return; }
      const members = (json.group?.members ?? []) as { email: string; name: string | null }[];
      const staged: StagedRecipient[] = members.map(m => ({ name: m.name, email: m.email, refCode: null }));
      setRecipients(staged);
      try { sessionStorage.setItem(RECIPIENTS_KEY, JSON.stringify(staged)); } catch { /* ignore */ }
      setLoadedGroupName(json.group?.name ?? null);
      setMessage(`Loaded ${staged.length} recipient(s) from “${json.group?.name}”. Nothing was sent — review, then preview/test/send as usual.`);
    } catch (e) { setMessage(`Load error: ${String(e)}`); } finally { setBusy(false); }
  }, []);

  const saveAsGroup = useCallback(async () => {
    if (!groupName.trim()) { setMessage("Name the group first."); return; }
    setBusy(true); setMessage(null);
    try {
      const members = recipients.map(r => ({ email: r.email, name: r.name }));
      const res = await fetch("/admin/growth/email/recipient-groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, description: groupDesc, members }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json.error ?? `Save failed (${res.status})`); return; }
      setMessage(`Saved ${json.memberCount} recipient(s) as “${json.name}”.`);
      setShowSaveGroup(false); setGroupName(""); setGroupDesc("");
      void refreshGroups();
    } catch (e) { setMessage(`Save error: ${String(e)}`); } finally { setBusy(false); }
  }, [groupName, groupDesc, recipients, refreshGroups]);

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white";
  const labelCls = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";
  const cardCls = "bg-white rounded-2xl border border-gray-200 p-5";
  const h2Cls = "font-[family-name:var(--font-playfair)] text-lg text-gray-900";
  const canRealSend = sendsEnabled && !!dryRunResult && dryRunResult.counts.willSend > 0 && (dryRunResult.missingGlobals?.length ?? 0) === 0 && confirmText === tpl.confirmPhrase && !busy;
  const fromLine = (() => {
    const name = (values.from_display_name ?? "").trim();
    if (templateId === "plain-message") { const a = (values.from_address ?? "").trim(); return name ? `${name} <${a}>` : a; }
    const bare = growthFromEmail.replace(/^.*<([^>]+)>.*$/, "$1");
    return name ? `${name} <${bare}>` : growthFromEmail.includes("<") ? growthFromEmail : `xyra <${bare}>`;
  })();
  const preheaderLine = (values.preheader ?? "").trim();
  const stepCls = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.16em] text-gray-400";

  const visibleGlobal = tpl.placeholders.filter(p => !isPerRecipient(p.key) && sectionEnabled(p));
  const visiblePerRecipient = tpl.placeholders.filter(p => isPerRecipient(p.key) && sectionEnabled(p));

  const templatesById: Record<string, string> = { "alpha-invite": "Alpha Invite (retired)", ...Object.fromEntries(GROWTH_TEMPLATES.map(t => [t.id, t.name])) };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 items-start">
      {/* ── Left: who + what ───────────────────────────────────────────── */}
      <div className="space-y-6 min-w-0">
        {/* 1 · Who */}
        <div className={cardCls}>
          <p className={stepCls}>1 · who&apos;s getting it</p>
          <div className="flex items-baseline justify-between mt-1">
            <h2 className={h2Cls}>{recipients.length === 0 ? "No one picked yet" : `${recipients.length} ${recipients.length === 1 ? "person" : "people"}`}</h2>
            {recipients.length > 0 && <button onClick={clearRecipients} className="text-xs text-gray-500 hover:text-gray-800 underline">Clear</button>}
          </div>
          {loadedGroupName && <p className="text-[11px] text-gray-400 mt-0.5">from the group <span className="font-medium text-gray-600">“{loadedGroupName}”</span></p>}

          {recipients.length === 0 ? (
            <p className="font-[family-name:var(--font-eb-garamond)] text-[15px] text-gray-500 leading-snug mt-1">
              Pick people on the <a href="/admin/users" className="text-gray-900 underline">Users</a> tab (filter or use a segment, then <span className="font-semibold">“Email selected”</span>), or load a saved group below. Preview and test sends work without anyone picked.
            </p>
          ) : (
            <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-2 text-xs text-gray-600 leading-relaxed">
              {recipients.map(r => (
                <div key={r.email} className="flex justify-between gap-3"><span className="truncate">{r.name || "—"}</span><span className="font-mono text-gray-500 truncate">{r.email}</span></div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <select
              value=""
              onChange={e => { const id = Number(e.target.value); if (id) void loadGroup(id); e.currentTarget.value = ""; }}
              disabled={busy || groups.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white disabled:opacity-50"
            >
              <option value="">{groups.length === 0 ? "No saved groups" : "Load a saved group…"}</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.memberCount})</option>)}
            </select>
            <button type="button" onClick={() => setShowSaveGroup(s => !s)} disabled={recipients.length === 0} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
              Save as group
            </button>
            <a href="/admin/growth/email/groups" className="text-xs text-gray-500 underline hover:text-gray-800">Manage groups</a>
          </div>
          {showSaveGroup && (
            <div className="mt-3 rounded-xl border border-gray-200 p-3 space-y-2">
              <input className={inputCls} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name (e.g. Weekly update list)" />
              <input className={inputCls} value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="Description (optional)" />
              <div className="flex gap-2">
                <button type="button" onClick={saveAsGroup} disabled={busy || recipients.length === 0} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50">
                  Save {recipients.length} as group
                </button>
                <button type="button" onClick={() => setShowSaveGroup(false)} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* 2 · Write */}
        <div className={cardCls}>
          <p className={stepCls}>2 · write it</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {GROWTH_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setTemplateId(t.id)} className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${templateId === t.id ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {t.name}
              </button>
            ))}
          </div>
          <p className="font-[family-name:var(--font-eb-garamond)] text-[15px] text-gray-500 leading-snug mt-2">{tpl.description}</p>

          {/* AI draft, tucked away until wanted */}
          <div className="mt-4 rounded-xl border border-gray-200">
            <button type="button" onClick={() => setShowAi(v => !v)} className="w-full flex items-center justify-between px-3.5 py-2.5 text-left">
              <span className="text-sm text-gray-800"><span className="font-semibold">Draft it with AI</span> <span className="text-gray-400">· say what you want, it fills the fields</span></span>
              <span className="text-gray-400 text-xs">{showAi ? "hide" : "open"}</span>
            </button>
            {showAi && (
              <div className="px-3.5 pb-3.5">
                {aiDraftReady ? (
                  <>
                    <textarea
                      className={inputCls + " resize-y"}
                      rows={3}
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder="e.g. Tell everyone xyra works on their laptop now, mention the new widgets, and ask them to reply with what they'd want next."
                    />
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={generateDraft} disabled={aiBusy || busy} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50">
                        {aiBusy ? "Writing…" : "Write draft"}
                      </button>
                      <span className="text-[11px] text-gray-400">Never sends. Never makes up links.</span>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-snug">
                    Needs <span className="font-mono">ANTHROPIC_API_KEY</span> on the server.
                  </div>
                )}
              </div>
            )}
          </div>

          {tpl.sections.length > 0 && (
            <div className="mt-4">
              <p className={labelCls}>Include</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {tpl.sections.map(s => {
                  const enabled = sections[s.key] !== false;
                  return (
                    <button key={s.key} onClick={() => toggleSection(s.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${enabled ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                      {enabled ? "✓ " : ""}{s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
            <div>
              <label className={labelCls}>Subject{subjectMissing && <span className="text-red-400"> *</span>}</label>
              <input className={`${inputCls} mt-1`} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line" />
            </div>
            {visibleGlobal.map(p => (
              <div key={p.key}>
                <label className="block mb-1">
                  <span className={labelCls}>{p.label} {p.required && <span className="text-red-400">*</span>}</span>
                </label>
                {p.type === "images" ? (
                  <ImageGalleryField value={values[p.key] ?? ""} onChange={val => setValue(p.key, val)} ready={imageUploadReady} />
                ) : p.type === "image" ? (
                  <ImageField value={values[p.key] ?? ""} onChange={url => setValue(p.key, url)} ready={imageUploadReady} />
                ) : p.type === "select" ? (
                  <select className={inputCls} value={values[p.key] ?? ""} onChange={e => setValue(p.key, e.target.value)}>
                    {(p.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : p.multiline ? (
                  <textarea className={inputCls + " resize-y"} rows={3} value={values[p.key] ?? ""} onChange={e => setValue(p.key, e.target.value)} placeholder={p.example} />
                ) : (
                  <input className={inputCls} value={values[p.key] ?? ""} onChange={e => setValue(p.key, e.target.value)} placeholder={p.example} />
                )}
                {p.help && p.type === "images" && <p className="text-[11px] text-gray-400 mt-2 leading-snug">{p.help}</p>}
                {p.help && p.type !== "image" && p.type !== "images" && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{p.help}</p>}
              </div>
            ))}
          </div>

          {visiblePerRecipient.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className={labelCls}>Filled in for each person</p>
              <p className="font-[family-name:var(--font-eb-garamond)] text-[15px] text-gray-500 mt-1 mb-3">On a real send these come from each person&apos;s account. What you type here only changes the preview.</p>
              <div className="space-y-3">
                {visiblePerRecipient.map(p => (
                  <div key={p.key}>
                    <label className="block mb-1"><span className={labelCls}>{p.label}</span></label>
                    <input className={inputCls} value={values[p.key] ?? ""} onChange={e => setValue(p.key, e.target.value)} placeholder={p.example} />
                    {p.help && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{p.help}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <button onClick={saveDraft} disabled={busy} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50">Save draft</button>
            <button onClick={resetDraft} disabled={busy} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">Start over from the default</button>
            <span className="text-[11px] text-gray-400">
              {persistence === "db" ? "Drafts save for everyone on the team" : persistence === "local" ? "Drafts save in this browser only" : ""}
            </span>
          </div>
        </div>

        {/* Past sends */}
        <div className={cardCls}>
          <h2 className={h2Cls}>Past sends</h2>
          {recentRuns.length === 0 ? (
            <p className="font-[family-name:var(--font-eb-garamond)] text-[15px] text-gray-500 mt-1">Nothing sent from here yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100">
              {recentRuns.map(r => (
                <li key={`${r.campaignKey}-${r.at}`} className="py-2 flex items-baseline justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 truncate">{r.subject}</p>
                    <p className="text-[11px] text-gray-400 truncate">{templatesById[r.templateId] ?? r.templateId} · {r.campaignKey}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-gray-700 tabular-nums">{r.count} {r.count === 1 ? "person" : "people"}</p>
                    <p className="text-[11px] text-gray-400">{new Date(r.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Right: preview + send, stays in view while you edit ───────────── */}
      <div className="space-y-6 min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
        {/* Preview */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className={stepCls}>3 · check it</p>
            <div className="flex gap-1">
              <button onClick={() => setDevice("desktop")} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${device === "desktop" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}>Laptop</button>
              <button onClick={() => setDevice("phone")} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${device === "phone" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}>Phone</button>
              <span className="w-2" />
              <button onClick={() => setPreviewMode("html")} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${previewMode === "html" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}>Email</button>
              <button onClick={() => setPreviewMode("text")} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${previewMode === "text" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}>Text only</button>
            </div>
          </div>

          {/* What it looks like in the inbox list */}
          <div className="rounded-xl border border-gray-200 px-3.5 py-2.5 mb-3">
            <div className="flex justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900 truncate">{fromLine.replace(/\s*<[^>]+>$/, "") || fromLine}</p>
              <p className="text-[11px] text-gray-400 shrink-0">now</p>
            </div>
            <p className="text-sm text-gray-900 truncate">{subject || <span className="text-red-400 italic">No subject yet</span>}</p>
            <p className="text-sm text-gray-500 truncate">{preheaderLine || <span className="text-gray-300">no preview text: the inbox shows the first line instead</span>}</p>
          </div>

          {(missing.length > 0 || subjectMissing) && (
            <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Still needed: {[...(subjectMissing ? ["Subject"] : []), ...missing.map(m => tpl.placeholders.find(p => p.key === m)?.label ?? m)].join(", ")}
            </div>
          )}
          <div className={`mx-auto transition-all ${device === "phone" ? "max-w-[390px]" : "max-w-none"}`}>
            {previewMode === "html" ? (
              <iframe title="Email preview" srcDoc={html} className="w-full h-[max(380px,calc(100vh-400px))] border border-gray-200 rounded-lg bg-white" />
            ) : (
              <pre className="w-full h-[max(380px,calc(100vh-400px))] overflow-auto border border-gray-200 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">{text}</pre>
            )}
          </div>
        </div>

        {/* Send */}
        <div className={cardCls}>
          <p className={stepCls}>4 · send it</p>

          {/* Test */}
          <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm text-gray-900 font-medium">Send a test first</p>
              <p className="text-xs text-gray-500 truncate">
                {hasInternalRecipients ? <>to {internalRecipients.join(", ")} · subject starts with [TEST]</> : <span className="text-amber-600">No test inbox set: add GROWTH_EMAIL_TEST_RECIPIENTS</span>}
              </p>
            </div>
            <button onClick={testSend} disabled={busy || !hasInternalRecipients} className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? "Working…" : "Send test"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">From {fromLine}{usingFallbackSender && <span className="text-amber-600"> · set GROWTH_EMAIL_FROM for a dedicated sender</span>}</p>

          <div className="mt-4 pt-4 border-t border-gray-100">
            {!sendsEnabled ? (
              <p className="font-[family-name:var(--font-eb-garamond)] text-[15px] text-gray-600 leading-relaxed">
                Real sends are off. Set <span className="font-mono text-xs bg-gray-100 px-1 rounded">ENABLE_GROWTH_EMAIL_SENDS=true</span> on the server to turn them on.
              </p>
            ) : recipients.length === 0 ? (
              <p className="font-[family-name:var(--font-eb-garamond)] text-[15px] text-gray-500">Pick people in step 1 to send for real.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm text-gray-900 font-medium">Send to {recipients.length} {recipients.length === 1 ? "person" : "people"}</p>
                    <p className="text-xs text-gray-500">First check who it will actually reach. Nothing sends yet.</p>
                  </div>
                  <button onClick={runDry} disabled={busy} className="px-4 py-2 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    {busy && !dryRunResult ? "Checking…" : "Check recipients"}
                  </button>
                </div>

                {dryRunResult && (
                  <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                    <div className="text-sm text-gray-900"><strong>{dryRunResult.counts.willSend}</strong> will get it</div>
                    {dryRunResult.counts.skippedDuplicate > 0 && <div>{dryRunResult.counts.skippedDuplicate} already got this one, skipped: {dryRunResult.skippedDuplicate.join(", ")}</div>}
                    {dryRunResult.skippedUnknown.length > 0 && <div className="text-amber-700">{dryRunResult.skippedUnknown.length} aren&apos;t xyra users, skipped: {dryRunResult.skippedUnknown.join(", ")}</div>}
                    {dryRunResult.skippedInvalid.length > 0 && <div className="text-red-600">Not real email addresses, skipped: {dryRunResult.skippedInvalid.join(", ")}</div>}
                    {dryRunResult.counts.placeholderName > 0 && <div className="text-gray-500">{dryRunResult.counts.placeholderName} have no name on file and get &quot;Hey,&quot; instead of &quot;Hi Alex,&quot;.</div>}
                    {(dryRunResult.missingGlobals?.length ?? 0) > 0 && <div className="text-red-600">Fill these in first: {dryRunResult.missingGlobals!.map(k => tpl.placeholders.find(p => p.key === k)?.label ?? k).join(", ")}</div>}
                  </div>
                )}

                {dryRunResult && dryRunResult.counts.willSend > 0 && (
                  <>
                    <div>
                      <label className={labelCls}>Type <span className="font-mono text-red-600 normal-case">{tpl.confirmPhrase}</span> to send</label>
                      <input className={`${inputCls} mt-1`} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={tpl.confirmPhrase} />
                    </div>
                    <button onClick={realSend} disabled={!canRealSend} className="w-full px-4 py-2.5 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      Send to {dryRunResult.counts.willSend} {dryRunResult.counts.willSend === 1 ? "person" : "people"}
                    </button>
                  </>
                )}

                <details className="text-[11px] text-gray-400">
                  <summary className="cursor-pointer">Campaign key: {effectiveKey}</summary>
                  <p className="mt-1">Nobody gets the same campaign twice. Change it to send this again to people who already got it.</p>
                  <input className={`${inputCls} mt-1`} value={campaignKey} onChange={e => setCampaignKey(e.target.value)} placeholder={suggestedKey} />
                </details>
              </div>
            )}
          </div>
        </div>

        {message && <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">{message}</div>}
      </div>
    </div>
  );
}
