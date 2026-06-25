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
  PER_RECIPIENT_KEYS,
  type PlaceholderDef,
} from "@/lib/growthEmailTemplates";

const RECIPIENTS_KEY = "xyra_growth_recipients";
const draftKey = (id: string) => `xyra_email_draft_${id}`;

type StagedRecipient = { name: string | null; email: string; refCode: string | null };
type Draft = { subject: string; values: Record<string, string>; sections: Record<string, boolean> };
type DryRunResult = {
  counts: { requested: number; willSend: number; skippedDuplicate: number; skippedUnknown: number };
  willSend: string[];
  skippedDuplicate: string[];
  skippedUnknown: string[];
  missingGlobals?: string[];
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

export default function EmailOps({
  sendsEnabled,
  hasInternalRecipients,
  internalRecipients,
  imageUploadReady,
  aiDraftReady,
  growthFromEmail,
  usingFallbackSender,
}: {
  sendsEnabled: boolean;
  hasInternalRecipients: boolean;
  internalRecipients: string[];
  imageUploadReady: boolean;
  aiDraftReady: boolean;
  growthFromEmail: string;
  usingFallbackSender: boolean;
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
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

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
        body: JSON.stringify({ templateId, subject, values, sections: draft.sections, recipients: recipientEmails, campaignKey, dryRun: true }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(`Dry run failed: ${json.error ?? res.status}`);
      else { setDryRunResult(json as DryRunResult); setMessage(`Dry run OK — ${json.counts.willSend} would send, ${json.counts.skippedDuplicate} already sent, ${json.counts.skippedUnknown} not on waitlist.`); }
    } catch (e) { setMessage(`Dry run error: ${String(e)}`); } finally { setBusy(false); }
  }, [templateId, subject, values, draft.sections, recipientEmails, campaignKey]);

  const realSend = useCallback(async () => {
    if (confirmText !== tpl.confirmPhrase) { setMessage(`Type "${tpl.confirmPhrase}" exactly to confirm.`); return; }
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/admin/growth/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, subject, values, sections: draft.sections, recipients: recipientEmails, campaignKey, confirm: confirmText }),
      });
      const json = await res.json();
      if (!res.ok) setMessage(`Send failed: ${json.error ?? res.status}`);
      else { setMessage(`Sent ${json.counts.sent} · failed ${json.counts.failed} · skipped dup ${json.counts.skippedDuplicate} · unknown ${json.counts.skippedUnknown}.`); setConfirmText(""); setDryRunResult(null); }
    } catch (e) { setMessage(`Send error: ${String(e)}`); } finally { setBusy(false); }
  }, [confirmText, tpl, templateId, subject, values, draft.sections, recipientEmails, campaignKey]);

  const clearRecipients = useCallback(() => {
    setRecipients([]);
    try { sessionStorage.removeItem(RECIPIENTS_KEY); } catch { /* ignore */ }
  }, []);

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white";
  const labelCls = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";
  const cardCls = "bg-white rounded-2xl border border-gray-200 p-5";
  const h2Cls = "font-[family-name:var(--font-playfair)] text-lg text-gray-900";
  const canRealSend = sendsEnabled && !!dryRunResult && dryRunResult.counts.willSend > 0 && (dryRunResult.missingGlobals?.length ?? 0) === 0 && confirmText === tpl.confirmPhrase && campaignKey.trim().length > 0 && !busy;

  const visibleGlobal = tpl.placeholders.filter(p => !isPerRecipient(p.key) && sectionEnabled(p));
  const visiblePerRecipient = tpl.placeholders.filter(p => isPerRecipient(p.key) && sectionEnabled(p));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Left: template + editor + recipients ───────────────────────── */}
      <div className="space-y-6">
        {/* Template selector */}
        <div className={cardCls}>
          <h2 className={h2Cls}>Template</h2>
          <div className="flex flex-wrap gap-2 mt-3 mb-2">
            {GROWTH_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setTemplateId(t.id)} className={`px-3.5 py-1.5 rounded-full text-xs font-medium font-[family-name:var(--font-jetbrains)] tracking-wide transition-colors ${templateId === t.id ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                {t.name}
              </button>
            ))}
          </div>
          <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 leading-snug">{tpl.description}</p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button onClick={saveDraft} disabled={busy} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50">Save draft</button>
            <button onClick={resetDraft} disabled={busy} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">Reset to default</button>
            <span className="text-[11px] text-gray-400">
              {persistence === "db" ? "Saves to database" : persistence === "local" ? "Saves to this browser (DB table not applied)" : "Checking persistence…"}
            </span>
          </div>
        </div>

        {/* AI draft assist */}
        <div className={cardCls}>
          <h2 className={h2Cls}>Draft with AI</h2>
          <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mt-0.5 mb-3">
            Describe what you want to say. It fills the fields below in Xyra&apos;s voice. It never sends, and every field stays editable.
          </p>
          {aiDraftReady ? (
            <>
              <textarea
                className={inputCls + " resize-y"}
                rows={3}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. Tell the waitlist alpha opens Monday, we polished reminders this week, and ask people to reply if they want early access."
              />
              <button onClick={generateDraft} disabled={aiBusy || busy} className="mt-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50">
                {aiBusy ? "Generating…" : "Generate draft"}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-snug">
              AI draft assist needs a one-time setup: set <span className="font-mono">ANTHROPIC_API_KEY</span> in the server environment. Until then, write drafts manually below. The key stays server-side and is never exposed to the browser.
            </div>
          )}
        </div>

        {/* Sections */}
        {tpl.sections.length > 0 && (
          <div className={cardCls}>
            <h2 className={h2Cls}>Sections</h2>
            <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mt-0.5 mb-3">Choose what to include in this email. Disabled sections are removed from the preview and the sent email.</p>
            <div className="flex flex-wrap gap-2">
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

        {/* Editor */}
        <div className={cardCls}>
          <h2 className={h2Cls}>Edit content</h2>
          <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mb-4">Subject and body are fully editable. Required fields are marked <span className="text-red-400">*</span>.</p>

          <div className="mb-4">
            <label className={labelCls}>Subject{subjectMissing && <span className="text-red-400"> *</span>}</label>
            <input className={`${inputCls} mt-1`} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line" />
          </div>

          <div className="space-y-3">
            {visibleGlobal.map(p => (
              <div key={p.key}>
                <label className="flex items-center justify-between mb-1">
                  <span className={labelCls}>{p.label} {p.required && <span className="text-red-400">*</span>}</span>
                  <span className="font-mono text-[10px] text-gray-300">{`{{${p.key}}}`}</span>
                </label>
                {p.type === "image" ? (
                  <ImageField value={values[p.key] ?? ""} onChange={url => setValue(p.key, url)} ready={imageUploadReady} />
                ) : p.multiline ? (
                  <textarea className={inputCls + " resize-y"} rows={3} value={values[p.key] ?? ""} onChange={e => setValue(p.key, e.target.value)} placeholder={p.example} />
                ) : (
                  <input className={inputCls} value={values[p.key] ?? ""} onChange={e => setValue(p.key, e.target.value)} placeholder={p.example || `{{${p.key}}}`} />
                )}
                {p.help && p.type !== "image" && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{p.help}</p>}
              </div>
            ))}
          </div>

          {visiblePerRecipient.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className={labelCls}>Auto-filled per recipient</p>
              <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mt-1 mb-3">On a real send these come from each recipient&apos;s waitlist record — the values below are only sample text for the preview.</p>
              <div className="space-y-3">
                {visiblePerRecipient.map(p => (
                  <div key={p.key}>
                    <label className="flex items-center justify-between mb-1">
                      <span className={labelCls}>{p.label}</span>
                      <span className="font-[family-name:var(--font-jetbrains)] text-[9px] uppercase tracking-wide text-blue-400">auto on send</span>
                    </label>
                    <input className={inputCls} value={values[p.key] ?? ""} onChange={e => setValue(p.key, e.target.value)} placeholder={p.example} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recipients */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-1">
            <h2 className={h2Cls}>Selected recipients</h2>
            <span className="font-[family-name:var(--font-jetbrains)] text-xs text-gray-500">{recipients.length} staged</span>
          </div>
          {recipients.length === 0 ? (
            <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 leading-snug">
              None staged. Go to <span className="font-semibold">Growth</span>, select users, and click <span className="font-semibold">“Email selected →”</span>. Preview and test-send work without recipients.
            </p>
          ) : (
            <>
              <div className="max-h-40 overflow-y-auto text-xs text-gray-600 font-mono leading-relaxed border border-gray-100 rounded-lg p-2 bg-gray-50">
                {recipients.map(r => <div key={r.email}>{r.email}</div>)}
              </div>
              <button onClick={clearRecipients} className="mt-2 text-xs text-gray-500 hover:text-gray-800 underline">Clear staged recipients</button>
            </>
          )}
        </div>
      </div>

      {/* ── Right: preview + sending ───────────────────────────────────── */}
      <div className="space-y-6">
        {/* Preview */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-3">
            <h2 className={h2Cls}>Preview</h2>
            <div className="flex gap-1">
              <button onClick={() => setPreviewMode("html")} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${previewMode === "html" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}>HTML</button>
              <button onClick={() => setPreviewMode("text")} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${previewMode === "text" ? "bg-black text-white" : "bg-gray-100 text-gray-600"}`}>Plain text</button>
            </div>
          </div>
          <div className="mb-2">
            <span className={labelCls}>Subject</span>
            <p className="text-sm font-medium text-gray-900">{subject || <span className="text-red-400 italic">No subject set</span>}</p>
          </div>
          {(missing.length > 0 || subjectMissing) && (
            <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {subjectMissing && <div>Subject is required.</div>}
              {missing.length > 0 && <div>Missing required: {missing.map(m => `{{${m}}}`).join(", ")} — shown as literal tokens until filled.</div>}
            </div>
          )}
          {previewMode === "html" ? (
            <iframe title="Email preview" srcDoc={html} className="w-full h-[560px] border border-gray-200 rounded-lg bg-white" />
          ) : (
            <pre className="w-full h-[560px] overflow-auto border border-gray-200 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">{text}</pre>
          )}
        </div>

        {/* Test send */}
        <div className={cardCls}>
          <h2 className={h2Cls}>Test send</h2>
          <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-600 leading-snug mb-2">
            Test sends go <strong>only to internal admin recipients</strong> — never to waitlist users. The subject line
            will start with <span className="font-mono text-xs bg-gray-100 px-1 rounded">[TEST]</span> so it&apos;s clearly marked.
          </p>
          {hasInternalRecipients ? (
            <p className="text-xs text-gray-500 mb-1">Will send to: <span className="font-mono text-gray-700">{internalRecipients.join(", ")}</span></p>
          ) : (
            <p className="text-xs text-amber-600 mb-1">No internal recipients configured — set GROWTH_EMAIL_TEST_RECIPIENTS or ANALYTICS_REPORT_RECIPIENTS.</p>
          )}
          <p className="text-xs text-gray-500 mb-3">
            From: <span className="font-mono text-gray-700">{growthFromEmail}</span>
            {usingFallbackSender && (
              <span className="text-amber-600"> · using the analytics fallback sender — set <span className="font-mono">GROWTH_EMAIL_FROM</span> to send Growth emails from a dedicated address.</span>
            )}
          </p>
          <button onClick={testSend} disabled={busy || !hasInternalRecipients} className="px-4 py-2 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? "Working…" : "Send test to myself"}
          </button>
        </div>

        {/* Real send (guarded) */}
        <div className={`rounded-2xl border p-5 ${sendsEnabled ? "bg-white border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <h2 className={h2Cls}>Real send to selected recipients</h2>
          {!sendsEnabled ? (
            <div className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-600 leading-relaxed space-y-2">
              <p><strong>Disabled.</strong> Real sends to waitlist users stay off unless <span className="font-mono text-xs bg-gray-100 px-1 rounded">ENABLE_GROWTH_EMAIL_SENDS=true</span> is set on the server. Don&apos;t turn this on until we&apos;ve explicitly decided to send from the app and tested it.</p>
              <p>For a true bulk newsletter, <strong>Zoho remains the recommended channel</strong> for now — use <span className="font-semibold">Copy / Export CSV</span> on the Growth page to get the recipient list.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 leading-snug">
                ⚠ This emails real waitlist users via Resend. Only the {recipients.length} staged recipient(s) are considered; unknown or already-sent addresses are skipped. Run a dry run first.
              </div>
              <div>
                <label className={labelCls}>Campaign key (for dedup logging)</label>
                <input className={`${inputCls} mt-1`} value={campaignKey} onChange={e => setCampaignKey(e.target.value)} placeholder="e.g. alpha-2026-06-29" />
              </div>
              <button onClick={runDry} disabled={busy || recipients.length === 0 || !campaignKey.trim()} className="px-4 py-2 rounded-full text-sm font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                {busy ? "Working…" : "1 · Run dry run"}
              </button>
              {dryRunResult && (
                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                  <div><strong>{dryRunResult.counts.willSend}</strong> will send · <strong>{dryRunResult.counts.skippedDuplicate}</strong> already sent · <strong>{dryRunResult.counts.skippedUnknown}</strong> not on waitlist</div>
                  {(dryRunResult.missingGlobals?.length ?? 0) > 0 && <div className="text-red-600">Fill required fields before sending: {dryRunResult.missingGlobals!.map(k => `{{${k}}}`).join(", ")}</div>}
                  {dryRunResult.skippedUnknown.length > 0 && <div className="text-amber-600">Unknown: {dryRunResult.skippedUnknown.join(", ")}</div>}
                </div>
              )}
              <div>
                <label className={labelCls}>Type <span className="font-mono text-red-600">{tpl.confirmPhrase}</span> to confirm</label>
                <input className={`${inputCls} mt-1`} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={tpl.confirmPhrase} />
              </div>
              <button onClick={realSend} disabled={!canRealSend} className="px-4 py-2 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                2 · Send to {dryRunResult ? dryRunResult.counts.willSend : recipients.length} recipient(s)
              </button>
            </div>
          )}
        </div>

        {message && <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-700">{message}</div>}
      </div>
    </div>
  );
}
