"use client";

// ─── BrainFile ───────────────────────────────────────────────────────────────
// A node's file, the app's BrainNodePanel on the site: breadcrumbs, the file
// kind, the title, a properties block, then sections of rows. An area is a
// folder of its shelves and boards; a shelf is its memories, each tagged with
// where xyra got it; a board is its latest entries; the center is the index.
// Rows that name another node open it. Reads heroWorld.ts, nothing live.

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { FileText, LayoutGrid, Folder, X } from "lucide-react";
import { BOARD_COUNT, MEMORY_COUNT, SOURCES, WORLD, boardsOf, shelvesOf, selId, type Line, type Selection } from "./heroWorld";

const MONO = "font-[family-name:var(--font-jetbrains)]";
const SERIF = "font-[family-name:var(--font-playfair)]";
const EASE = [0.22, 1, 0.36, 1] as const;

const Section = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-1 mt-7 flex items-baseline justify-between border-b border-black/10 pb-1.5">
    <div className={`${MONO} text-[10px] uppercase tracking-[0.2em] text-black/45`}>{children}</div>
    {right !== undefined ? <div className={`${MONO} text-[10px] text-black/35`}>{right}</div> : null}
  </div>
);

const Properties = ({ rows }: { rows: [string, ReactNode][] }) => (
  <div className={`mt-4 grid grid-cols-[84px_1fr] gap-x-4 gap-y-1.5 ${MONO} text-[11px]`}>
    {rows.map(([k, val]) => (
      <div key={k} className="contents">
        <div className="text-black/35">{k}</div>
        <div className="text-black/80">{val}</div>
      </div>
    ))}
  </div>
);

const FileRow = ({ icon, name, preview, meta, italic, onClick }: { icon: ReactNode; name: string; preview?: string; meta?: string; italic?: boolean; onClick: () => void }) => (
  <button onClick={onClick} className="group flex w-full items-start gap-3 border-b border-black/[0.06] py-3 text-left transition-colors hover:bg-black/[0.03]">
    <span className="mt-[3px] text-black/40 group-hover:text-black">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className={`block ${SERIF} text-[16px] leading-tight ${italic ? "italic" : ""}`}>{name}</span>
      {preview ? <span className={`mt-1 block truncate ${MONO} text-[10px] text-black/45`}>{preview}</span> : null}
    </span>
    {meta ? <span className={`shrink-0 pt-[3px] ${MONO} text-[10px] text-black/35`}>{meta}</span> : null}
  </button>
);

const Lines = ({ lines, more }: { lines: Line[]; more?: number }) => (
  <>
    {lines.map(([text, meta], i) => (
      <motion.div key={text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06, duration: 0.3 }} className="flex gap-3 py-2">
        <span className="mt-[10px] h-[6px] w-[6px] shrink-0 rounded-full border border-black/40" />
        <span className="min-w-0">
          <span className={`block ${SERIF} text-[16px] leading-[1.55]`}>{text}</span>
          <span className={`mt-0.5 block ${MONO} text-[10px] text-black/35`}>{meta}</span>
        </span>
      </motion.div>
    ))}
    {more ? <div className={`py-2 pl-[18px] ${MONO} text-[10px] text-black/35`}>+ {more} more</div> : null}
  </>
);

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function BrainFile({ selection, onSelect, onClose, sheet }: { selection: Selection; onSelect: (s: Selection) => void; onClose: () => void; sheet: boolean }) {
  const area = selection.kind === "you" ? null : WORLD.find((a) => a.key === selection.key) ?? null;
  const moon = area && (selection.kind === "moon" || selection.kind === "page") ? area.moons.find((m) => m.id === selection.id) ?? null : null;
  const page = moon && moon.kind === "shelf" && selection.kind === "page" ? moon.pages?.find((p) => p.id === selection.page) ?? null : null;

  const crumbs: { label: string; go?: () => void }[] = [{ label: "your world", go: selection.kind === "you" ? undefined : () => onSelect({ kind: "you" }) }];
  if (area && selection.kind !== "area") crumbs.push({ label: area.label.toLowerCase(), go: () => onSelect({ kind: "area", key: area.key }) });
  if (area && moon && page) crumbs.push({ label: moon.title, go: () => onSelect({ kind: "moon", key: area.key, id: moon.id }) });

  const title = selection.kind === "you" ? "you" : page ? page.title : moon ? moon.title : area?.label ?? "";
  const fileKind = selection.kind === "you" ? "index" : selection.kind === "area" ? "folder" : page ? "sub-page" : moon?.kind === "board" ? "board" : "page";

  let body: ReactNode = null;
  if (selection.kind === "you") {
    body = (
      <>
        <Properties rows={[
          ["memories", MEMORY_COUNT],
          ["boards", BOARD_COUNT],
          ["sources", SOURCES.join(" · ")],
          ["read by", "claude · chatgpt · gemini"],
        ]} />
        <Section>your world</Section>
        {WORLD.map((a) => (
          <FileRow key={a.key} icon={<Folder size={14} />} name={a.label.toLowerCase()}
            meta={`${count(a.moons.length, "file", "files")}`}
            onClick={() => onSelect({ kind: "area", key: a.key })} />
        ))}
      </>
    );
  } else if (area && selection.kind === "area") {
    const shelves = shelvesOf(area), boards = boardsOf(area);
    const memories = shelves.reduce((n, s) => n + s.n, 0);
    body = (
      <>
        <Properties rows={[
          ["boards", boards.length],
          ["shelves", `${shelves.length} · ${count(memories, "memory", "memories")}`],
          ["entries", boards.reduce((n, b) => n + b.entries, 0)],
        ]} />
        {shelves.length > 0 && (
          <>
            <Section>memory shelves</Section>
            {shelves.map((s) => (
              <FileRow key={s.id} icon={<FileText size={14} />} name={s.title} italic meta={count(s.n, "memory", "memories")}
                onClick={() => onSelect({ kind: "moon", key: area.key, id: s.id })} />
            ))}
          </>
        )}
        {boards.length > 0 && (
          <>
            <Section>boards</Section>
            {boards.map((b) => (
              <FileRow key={b.id} icon={<LayoutGrid size={14} />} name={b.title} preview={b.headline} meta={count(b.entries, "entry", "entries")}
                onClick={() => onSelect({ kind: "moon", key: area.key, id: b.id })} />
            ))}
          </>
        )}
      </>
    );
  } else if (area && moon && page) {
    body = (
      <>
        <Section right={page.n}>memories</Section>
        <Lines lines={page.memories} more={page.n - page.memories.length} />
      </>
    );
  } else if (area && moon?.kind === "shelf") {
    const paged = (moon.pages ?? []).reduce((n, p) => n + p.n, 0);
    body = (
      <>
        <Section right={moon.n}>memories</Section>
        <Lines lines={moon.memories} more={moon.n - paged - moon.memories.length} />
        {moon.pages?.length ? (
          <>
            <Section>pages</Section>
            {moon.pages.map((p) => (
              <FileRow key={p.id} icon={<FileText size={14} />} name={p.title} italic meta={count(p.n, "memory", "memories")}
                onClick={() => onSelect({ kind: "page", key: area.key, id: moon.id, page: p.id })} />
            ))}
          </>
        ) : null}
      </>
    );
  } else if (moon?.kind === "board") {
    body = (
      <>
        <Properties rows={[["entries", moon.entries], ["today", moon.today], ["now", moon.headline]]} />
        <Section>latest</Section>
        <Lines lines={moon.rows} />
      </>
    );
  }

  return (
    <motion.aside
      key={selId(selection)}
      initial={sheet ? { opacity: 0, y: 28 } : { opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={sheet ? { opacity: 0, y: 20 } : { opacity: 0, x: 20 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={
        sheet
          ? "pointer-events-auto absolute inset-x-3 bottom-3 z-40 flex max-h-[52%] flex-col rounded-2xl border border-black/10 bg-white text-black"
          : "pointer-events-auto absolute right-6 top-[290px] xl:top-[88px] max-h-[calc(100%-314px)] xl:max-h-[calc(100%-112px)] z-40 flex w-[min(440px,40%)] flex-col rounded-2xl border border-black/10 bg-white text-black"
      }
      style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.10)" }}
      aria-label={`${title} ${fileKind}`}
    >
      <div className="flex items-center justify-between px-6 pb-2 pt-5 sm:px-8">
        <nav className={`flex min-w-0 items-center gap-1.5 ${MONO} text-[10px] tracking-[0.18em] text-black/40`}>
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-1.5 whitespace-nowrap">
              {i > 0 ? <span className="text-black/20">/</span> : null}
              {c.go ? <button onClick={c.go} className="hover:text-black">{c.label}</button> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
        <button onClick={onClose} aria-label="close" title="close (esc)" className="rounded p-1 text-black/40 hover:bg-black/[0.06] hover:text-black"><X size={16} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 sm:px-8" data-lenis-prevent>
        <div className={`${MONO} text-[10px] text-black/35`}>{fileKind}</div>
        <h2 className={`mt-1 ${SERIF} text-[30px] leading-[1.1] tracking-[-0.02em] sm:text-[34px]`}>{title}</h2>
        {body}
      </div>
    </motion.aside>
  );
}
