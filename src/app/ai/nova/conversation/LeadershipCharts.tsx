import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown, ArrowUp, BarChart3, Check, ChevronLeft, ChevronRight, Download, Filter, Info,
  LayoutDashboard, Maximize2, Minimize2, MoreHorizontal, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  dataset, freshness, kpis, PROBLEMS, SECURITY, type ChartData, type KpiSpec,
} from '../mockAnalytics';
import { prefersReducedMotion } from '../novaMotion';
import { addTile, removeTile, useTicketStore, type DashboardTile } from '../mockTickets';
import type { RequesterBlock } from '../scripts/registry';

/* THE LEADERSHIP VISUAL PRIMITIVES — numbers first, prose rationed.
 *
 * ── THE CHARTING LIBRARY ────────────────────────────────────────────────────────────────────
 * The product's dashboards (bomDashboardUi.tsx) draw their rings and bars as hand-rolled SVG;
 * `recharts` is declared in package.json but imported only by the unused shadcn wrapper
 * `ui/chart.tsx`. These primitives follow the dashboards — inline SVG with a viewBox — which
 * also means they render in jsdom, where a ResizeObserver-driven library draws nothing.
 *
 * ── ONE FRAME ───────────────────────────────────────────────────────────────────────────────
 * Every chart lives in a ChartFrame: the visual, the toolbar (chart type · group by · expand ·
 * regenerate · + dashboard), the freshness stamp, the drill breadcrumb, an aria-label stating
 * the finding, and a table fallback. No bare charts.
 *
 * ── COLOUR ──────────────────────────────────────────────────────────────────────────────────
 * Four categorical hues in a FIXED order (validated with the dataviz palette checks — lightness
 * band, chroma floor, CVD separation, contrast all pass on white); status colours are the
 * product's own good/bad/warn and are never reused as a series. Text wears text tokens.
 */

/* FOUR GREYS, in fixed order, never cycled — ink, slate, silver, iron. Lightness alone would be
   a thin distinction, so every line series past the first also carries its own dash (see
   `DASH`), and the grouped bars already say "second series" with opacity. SVG presentation
   attributes accept var(), so these read the same table the stylesheet does. */
export const SERIES = ['var(--nova-g900)', 'var(--nova-g600)', 'var(--nova-g500)', 'var(--nova-g700)'] as const;
const DASH = [undefined, '6 3', '2 3', '8 3 2 3'] as const;
const GOOD = 'var(--nova-success)';
const BAD = 'var(--nova-error)';
const WARN = 'var(--nova-warning)';
const TRACK = 'var(--nova-g200)';
const RULE = 'var(--nova-border)';
const INK = 'var(--nova-text-primary)';
const INK_MUTED = 'var(--nova-text-secondary)';
const INK_FAINT = 'var(--nova-text-muted)';

const fmtN = (n: number) => n.toLocaleString('en-IN');

/* ── KpiStrip ───────────────────────────────────────────────────────────────────────────
 *
 *     1,284                        ↑ 8.4%
 *     Open tickets
 *
 * THE TREND RIDES THE NUMBER'S LINE. It used to sit on a third row of its own, which cost the
 * card a line of height and read as a separate fact rather than as something that happened TO
 * the number beside it. Hard right on the same baseline says "this number, this much" in one
 * glance — and the card gets shorter, not taller.
 *
 * Nothing else changed: same value, same label, same semantic colour, same "(worse)/(better)"
 * said out loud for anyone who cannot see the arrow. */
export function KpiStrip({ items }: { items: KpiSpec[] }) {
  return (
    <div className="nova-kpis" data-kpi-strip>
      {items.map((k) => (
        <div key={k.label} className="nova-kpi">
          <div className="nova-kpi-top">
            <p className="nova-kpi-value" data-kpi-value>{k.value}</p>
            {k.delta && (
              <span className={`nova-delta ${k.bad ? 'nova-delta-bad' : 'nova-delta-good'}`} data-bad={k.bad ? 'true' : 'false'}>
                {k.dir === 'down' ? <ArrowDown size={10} aria-hidden="true" /> : <ArrowUp size={10} aria-hidden="true" />}
                {k.delta}
                <span className="sr-only">{k.bad ? ' (worse)' : ' (better)'}</span>
              </span>
            )}
          </div>
          <p className="nova-kpi-label" data-kpi-label>{k.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Callout ────────────────────────────────────────────────────────────── */
export function Callout({ text }: { text: string }) {
  return <p className="nova-callout nova-t-body" data-callout>{text}</p>;
}

/* ── Breadcrumb ─────────────────────────────────────────────────────────── */
export function Breadcrumb({ crumbs, onGo }: { crumbs: string[]; onGo: (i: number) => void }) {
  if (!crumbs.length) return null;
  return (
    <nav aria-label="Drill path" className="flex flex-wrap items-center gap-1 ask-text-sm" data-breadcrumb>
      {['All', ...crumbs].map((c, i) => (
        <span key={`${c}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden="true" className="text-[var(--nova-ink-faint)]">›</span>}
          <button
            type="button"
            onClick={() => onGo(i)}
            className={`nova-btn rounded px-1 ${i === crumbs.length ? 'ask-w-500 text-[var(--nova-ink)]' : 'text-[var(--nova-primary)] hover:bg-[var(--nova-surface-hover)]'}`}
          >{c}</button>
        </span>
      ))}
    </nav>
  );
}

/* ── DataTable — the fallback for every chart, sortable ─────────────────── */
export function DataTable({ columns, rows, onRow, rowAction, rowClass }: {
  columns: string[]; rows: Array<Array<string | number>>; onRow?: (row: Array<string | number>) => void;
  /** Technician tables: an action cell per row, and a class per row (an at-risk highlight). */
  rowAction?: (row: Array<string | number>) => ReactNode;
  rowClass?: (row: Array<string | number>) => string | undefined;
}) {
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const num = (v: string | number) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, '')));
    const numeric = rows.every((r) => !Number.isNaN(num(r[sort.i])));
    return [...rows].sort((a, b) => {
      const x = a[sort.i]; const y = b[sort.i];
      const c = numeric ? num(x) - num(y) : String(x).localeCompare(String(y));
      return c * sort.dir;
    });
  }, [rows, sort]);
  return (
    <div className="nova-table-wrap" data-data-table>
      <table className="nova-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              /* A column sort re-orders the rows in place — in-element, never a forward action. */
              <th key={c} scope="col" data-in-element="sort" aria-sort={sort?.i === i ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                <button
                  type="button"
                  className="nova-btn inline-flex items-center gap-1 rounded text-left"
                  onClick={() => setSort((s) => (s?.i === i ? { i, dir: s.dir === 1 ? -1 : 1 } : { i, dir: 1 }))}
                >
                  {c}
                  {sort?.i === i && (sort.dir === 1 ? <ArrowUp size={10} aria-hidden="true" /> : <ArrowDown size={10} aria-hidden="true" />)}
                </button>
              </th>
            ))}
            {rowAction && <th scope="col"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, ri) => (
            <tr key={ri} onClick={onRow ? () => onRow(r) : undefined}
              className={[onRow ? 'cursor-pointer hover:bg-[var(--nova-surface-hover)]' : '', rowClass?.(r) ?? ''].join(' ').trim() || undefined}>
              {r.map((cell, ci) => <td key={ci} className={typeof cell === 'number' ? 'tabular-nums' : undefined}>{cell}</td>)}
              {rowAction && <td>{rowAction(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Every chart shape, as rows — the table fallback and the CSV export both read this. */
export function toTable(d: ChartData): { columns: string[]; rows: Array<Array<string | number>> } {
  switch (d.shape) {
    case 'comparison':
      return { columns: ['Category', d.series[0].name, d.series[1].name, 'Change'],
        rows: d.categories.map((c, i) => [c, d.series[0].values[i], d.series[1].values[i], d.deltas[i]]) };
    case 'ranking':
      return { columns: ['Item', d.unit ?? 'Value', ...(d.rows.some((r) => r.secondary) ? ['Detail'] : []), ...(d.rows.some((r) => r.badge) ? ['Breaches'] : []), ...(d.rows.some((r) => r.delta) ? ['Change'] : [])],
        rows: d.rows.map((r) => [r.label, r.display ?? r.value, ...(d.rows.some((x) => x.secondary) ? [r.secondary ?? ''] : []), ...(d.rows.some((x) => x.badge) ? [r.badge ?? '—'] : []), ...(d.rows.some((x) => x.delta) ? [r.delta ?? ''] : [])]) };
    case 'trend':
      return { columns: ['Period', ...d.series.map((s) => s.name)], rows: d.x.map((x, i) => [x, ...d.series.map((s) => s.values[i])]) };
    case 'gauge':
      return { columns: ['Month', 'Compliance %', 'Target %'], rows: d.trend.x.map((x, i) => [x, d.trend.values[i], d.target]) };
    case 'timeline':
      return { columns: ['Ref', 'Month', 'Severity', 'Type', 'Incident'], rows: d.events.map((e) => [e.id, d.months[Math.floor(e.x)], e.severity, e.type, e.label.split(' · ')[1] ?? e.label]) };
    case 'deadlines':
      return { columns: ['Ref', 'Title', 'Owner', 'Due'], rows: d.rows.map((r) => [r.ref, r.title, r.owner, r.dueDays < 0 ? `Overdue by ${-r.dueDays}d` : `in ${r.dueDays}d`]) };
    case 'matrix':
      return { columns: ['Problem', 'Effort to fix (1–10)', 'Recurrence', 'Size'], rows: d.points.map((p) => [p.label, p.x, p.y, p.sizeLabel]) };
    case 'table':
      return { columns: d.columns, rows: d.rows };
  }
}

/** A real CSV of the rows — quoted, RFC-ish, one line per row. */
export function toCsv(t: { columns: string[]; rows: Array<Array<string | number>> }): string {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [t.columns.map(q).join(','), ...t.rows.map((r) => r.map(q).join(','))].join('\n');
}

/** Download a CSV through a blob URL. Says what it did; a sandbox that cannot download still
 *  gets the honest toast rather than silence. */
export function downloadCsv(filename: string, csv: string): void {
  saveBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

/** Save a blob under a filename. The one download path — `downloadCsv` and the image export
 *  both go through it, so "downloads are blocked here" is said once. */
function saveBlob(filename: string, blob: Blob, what = filename): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${what}`);
  } catch {
    toast(`Export prepared — ${what} (downloads are blocked in this environment)`);
  }
}

/** THE PLOT, not the first SVG in the card.
 *
 *  ⚠️ A comparison chart carries four SVGs: the plot and one 12px legend swatch per series, and
 *  `querySelector('svg')` returns a swatch — which exported a 12×12 dot and called it the chart.
 *  Scoped to the body and sized, so a future control with its own glyph cannot win either. */
function plotOf(host: HTMLElement | null): SVGSVGElement | null {
  const body = host?.querySelector('[data-chart-kind]') ?? host;
  return Array.from(body?.querySelectorAll('svg') ?? [])
    .reduce<SVGSVGElement | null>((best, el) => {
      const b = el.getBoundingClientRect();
      const a = b.width * b.height;
      if (a < 400) return best;                 // a swatch, never the plot
      const bb = best?.getBoundingClientRect();
      return !bb || a > bb.width * bb.height ? (el as SVGSVGElement) : best;
    }, null);
}

/** A copy of the plot with every paint written on as a literal.
 *
 *  ⚠️ THE CHARTS COLOUR THEMSELVES WITH `var(--nova-…)`, and a serialised SVG is rasterised (or
 *  printed) OUTSIDE this document, where no custom property resolves — so a naive clone comes
 *  back a black-and-transparent silhouette in a serif font. Computing the paints first is the
 *  whole difference between an export and a broken picture. */
function inlinePaint(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const live = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll('*'))];
  copies.forEach((el, i) => {
    const src = live[i];
    if (!src) return;
    const cs = window.getComputedStyle(src);
    (['fill', 'stroke', 'stop-color', 'font-size', 'font-weight', 'font-family', 'opacity', 'stroke-width'] as const)
      .forEach((prop) => {
        const v = cs.getPropertyValue(prop);
        if (v && v !== 'none' && v !== '' && v !== 'normal') el.setAttribute(prop, v);
      });
  });
  const box = svg.getBoundingClientRect();
  clone.setAttribute('width', String(Math.max(1, Math.round(box.width)) || 480));
  clone.setAttribute('height', String(Math.max(1, Math.round(box.height)) || 240));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return clone;
}

/** THE VISUAL, AS A PNG. Drawn at 2× so it survives being pasted into a deck. */
function exportImage(host: HTMLElement | null, filename: string): void {
  const svg = plotOf(host);
  if (!svg) { toast('This visual has no chart to export — try Data (CSV)'); return; }
  const clone = inlinePaint(svg);
  const box = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width)) || 480;
  const h = Math.max(1, Math.round(box.height)) || 240;
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w * 2; canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) { toast('Export prepared — this browser cannot rasterise the chart'); return; }
    ctx.scale(2, 2);
    /* A transparent PNG on a dark slide is unreadable; the chart is drawn for white. */
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => { if (b) saveBlob(filename, b); else toast('Export prepared — this browser could not encode the image'); });
  };
  img.onerror = () => toast('Export prepared — this browser could not read the chart back');
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/** THE VISUAL, AS A PDF — through the browser's own print dialog, which is where "Save as PDF"
 *  lives. No renderer to add and no library to carry: a hidden iframe holds one clean sheet (the
 *  title, the chart, the sentence that reads it and what built it) and prints just that.
 *
 *  ⚠️ THE SAME COLOUR PROBLEM AS THE PNG, for the same reason — a print document is its own
 *  document and resolves none of this one's custom properties — so it reuses `inlinePaint`. */
function exportPdf(host: HTMLElement | null, title: string, summary: string, basis: string): void {
  const svg = plotOf(host);
  if (!svg) { toast('This visual has no chart to print — try Data (CSV)'); return; }
  const clone = inlinePaint(svg);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); toast('Export prepared — this browser blocked the print sheet'); return; }
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  doc.open();
  doc.write(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>
    body { margin: 32px; font: 13px/1.5 Inter, system-ui, sans-serif; color: #0B1628; }
    h1 { margin: 0 0 16px; font-size: 17px; font-weight: 600; }
    p { margin: 16px 0 0; }
    .basis { margin-top: 8px; font-size: 11px; color: #5A6D8C; }
    svg { max-width: 100%; height: auto; }
  </style><h1>${esc(title)}</h1>${new XMLSerializer().serializeToString(clone)}
  <p>${esc(summary)}</p><p class="basis">${esc(basis)}</p>`);
  doc.close();
  /* The sheet has to have laid out before it can be printed. */
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
    toast('Print sheet ready — choose "Save as PDF" to export');
  }, 250);
}

/** EMAIL AS PDF — the two halves this can honestly do: the mail draft is opened prefilled with
 *  the title, the reading and the data basis, and the print sheet is raised beside it so the PDF
 *  can be saved and attached. A browser cannot attach a file to a mail draft, so the toast says
 *  what is left for the reader to do rather than implying it was sent. */
function emailPdf(host: HTMLElement | null, title: string, summary: string, basis: string): void {
  exportPdf(host, title, summary, basis);
  const body = `${summary}\n\n${basis}\n\n(PDF attached — saved from the print dialog.)`;
  window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  toast('Mail draft opened — attach the PDF you save from the print dialog');
}

/* ── RankedBars ─────────────────────────────────────────────────────────── */
export function RankedBars({ d, onPick }: { d: Extract<ChartData, { shape: 'ranking' }>; onPick?: (label: string) => void }) {
  const max = Math.max(...d.rows.map((r) => Math.abs(r.value)), 1);
  const hasSecondary = d.rows.some((r) => r.secondary);
  return (
    <ul className="space-y-1.5" data-ranked-bars>
      {d.rows.map((r) => {
        const Row: 'button' | 'div' = onPick ? 'button' : 'div';
        return (
          <li key={r.label}>
            <Row
              {...(onPick ? { type: 'button' as const, onClick: () => onPick(r.label) } : {})}
              className={`nova-rank-row ${onPick ? 'nova-btn cursor-pointer hover:bg-[var(--nova-surface-hover)]' : ''}`}
              title={`${r.label}: ${r.display ?? r.value}${d.unit ? ` ${d.unit}` : ''}`}
            >
              <span className="nova-rank-label">{r.label}</span>
              <span className="nova-rank-track" aria-hidden="true">
                <span
                  className={`nova-rank-bar ${r.value < 0 ? 'nova-rank-bar-neg' : ''}`}
                  style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }}
                />
              </span>
              <span className="nova-rank-value tabular-nums">{r.display ?? fmtN(r.value)}</span>
              {hasSecondary && <span className="nova-rank-secondary">{r.secondary}</span>}
              {r.delta && <span className="nova-rank-secondary">{r.delta} vs prev.</span>}
              {r.badge && <span className="nova-rank-badge">{r.badge}</span>}
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

/* ── ComparisonBars ─────────────────────────────────────────────────────── */
export function ComparisonBars({ d, onPick }: { d: Extract<ChartData, { shape: 'comparison' }>; onPick?: (label: string) => void }) {
  const W = 480; const H = 210; const padL = 8; const padB = 34; const padT = 26;
  const n = d.categories.length;
  const slot = (W - padL * 2) / n;
  const max = Math.max(...d.series.flatMap((s) => s.values), 1);
  const barW = Math.min(22, slot * 0.28);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <div data-comparison-bars>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="presentation" className="nova-svg">
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={padL} x2={W - padL} y1={y(max * g)} y2={y(max * g)} stroke={RULE} strokeWidth="1" />
        ))}
        {d.categories.map((c, i) => {
          const cx = padL + slot * i + slot / 2;
          return (
            <g key={c} className={onPick ? 'cursor-pointer' : undefined} onClick={onPick ? () => onPick(c) : undefined}>
              <title>{`${c}: ${d.series[0].name} ${fmtN(d.series[0].values[i])} · ${d.series[1].name} ${fmtN(d.series[1].values[i])} (${d.deltas[i]})`}</title>
              {d.series.map((s, si) => {
                const v = s.values[i];
                const x = cx - barW - 1 + si * (barW + 2);
                return (
                  <rect key={s.name} x={x} y={y(v)} width={barW} height={Math.max(1, y(0) - y(v))} rx="3"
                    fill={SERIES[si]} opacity={si === 0 ? 1 : 0.55} />
                );
              })}
              <text x={cx} y={y(Math.max(d.series[0].values[i], d.series[1].values[i])) - 6} textAnchor="middle" className="nova-svg-xs" fill={INK}>
                {d.deltas[i]}
              </text>
              <text x={cx} y={H - 18} textAnchor="middle" className="nova-svg-xs" fill={INK_MUTED}>
                {c.length > 12 ? `${c.slice(0, 11)}…` : c}
              </text>
              <rect x={padL + slot * i} y={padT - 12} width={slot} height={H - padT} fill="transparent" />
            </g>
          );
        })}
      </svg>
      <Legend names={d.series.map((s) => s.name)} muted={[false, true]} />
    </div>
  );
}

function Legend({ names, muted }: { names: string[]; muted?: boolean[] }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 ask-text-xs text-[var(--nova-ink-muted)]" data-legend>
      {names.map((nm, i) => (
        <span key={nm} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2 rounded-sm" style={{ background: SERIES[i % SERIES.length], opacity: muted?.[i] ? 0.55 : 1 }} />
          {nm}
        </span>
      ))}
    </p>
  );
}

/* ── TrendLine ──────────────────────────────────────────────────────────── */
export function TrendLine({ d, onPick, compact }: {
  d: Extract<ChartData, { shape: 'trend' }>; onPick?: (series: string) => void; compact?: boolean;
}) {
  const W = 480; const H = compact ? 110 : 200; const padL = 30; const padR = 12; const padT = 18; const padB = 26;
  const all = d.series.flatMap((s) => s.values);
  const lo = Math.min(...all, d.target ?? Infinity);
  const hi = Math.max(...all, d.target ?? -Infinity, d.yMax ?? -Infinity);
  const span = Math.max(hi - lo, 1);
  const yMin = lo - span * 0.15; const yMax = hi + span * 0.2;
  const x = (i: number) => padL + ((W - padL - padR) * i) / Math.max(1, d.x.length - 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - yMin) / (yMax - yMin));
  const labelEvery = Math.ceil(d.x.length / 8);
  return (
    <div data-trend-line>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="presentation" className="nova-svg">
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={padL} x2={W - padR} y1={y(yMin + (yMax - yMin) * g)} y2={y(yMin + (yMax - yMin) * g)} stroke={RULE} strokeWidth="1" />
        ))}
        <text x={padL - 4} y={y(yMax) + 4} textAnchor="end" className="nova-svg-xs" fill={INK_FAINT}>{Math.round(yMax * 10) / 10}</text>
        <text x={padL - 4} y={y(yMin) + 4} textAnchor="end" className="nova-svg-xs" fill={INK_FAINT}>{Math.round(yMin * 10) / 10}</text>
        {d.target !== undefined && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(d.target)} y2={y(d.target)} stroke={INK_MUTED} strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={W - padR} y={y(d.target) - 4} textAnchor="end" className="nova-svg-xs" fill={INK_MUTED}>target {d.target}</text>
          </g>
        )}
        {d.series.map((s, si) => (
          <g key={s.name} className={onPick ? 'cursor-pointer' : undefined} onClick={onPick ? () => onPick(s.name) : undefined}>
            <title>{s.name}</title>
            <polyline fill="none" stroke={SERIES[si % SERIES.length]} strokeDasharray={DASH[si % DASH.length]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={d.x.length > 12 ? 2.5 : 4} fill="#fff" stroke={SERIES[si % SERIES.length]} strokeWidth="2">
                <title>{`${s.name} · ${d.x[i]}: ${v}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {d.annotate && (
          <g data-annotation>
            <line x1={x(d.annotate.i)} x2={x(d.annotate.i)} y1={padT - 4} y2={H - padB} stroke={INK} strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={x(d.annotate.i)} cy={y(d.series[0].values[d.annotate.i])} r="6" fill="none" stroke={INK} strokeWidth="1.5" />
            <text x={Math.min(x(d.annotate.i) + 8, W - 150)} y={padT + 4} className="nova-svg-xs" fill={INK}>{d.annotate.text}</text>
          </g>
        )}
        {d.x.map((lab, i) => (i % labelEvery === 0 || i === d.x.length - 1) && (
          <text key={lab + i} x={x(i)} y={H - 8} textAnchor="middle" className="nova-svg-xs" fill={INK_MUTED}>{lab}</text>
        ))}
      </svg>
      {d.series.length > 1 && <Legend names={d.series.map((s) => s.name)} />}
    </div>
  );
}

/* ── Gauge ──────────────────────────────────────────────────────────────── */
export function Gauge({ d }: { d: Extract<ChartData, { shape: 'gauge' }> }) {
  const R = 52; const cx = 70; const cy = 70; const start = 135; const sweep = 270;
  const lo = 90; const hi = 100;
  const angle = (v: number) => start + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * sweep;
  const pt = (deg: number, r = R) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (from: number, to: number, r = R) => {
    const [x1, y1] = pt(from, r); const [x2, y2] = pt(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const below = d.value < d.target;
  const [tx, ty] = pt(angle(d.target), R + 9);
  const [tx2, ty2] = pt(angle(d.target), R - 9);
  return (
    <div className="flex items-center gap-4" data-gauge data-below-target={below ? 'true' : 'false'}>
      <svg viewBox="0 0 140 130" width="140" height="130" role="presentation" className="flex-shrink-0">
        <path d={arc(start, start + sweep)} fill="none" stroke={TRACK} strokeWidth="10" strokeLinecap="round" />
        <path d={arc(start, angle(d.value))} fill="none" stroke={below ? BAD : GOOD} strokeWidth="10" strokeLinecap="round" />
        <line x1={tx} y1={ty} x2={tx2} y2={ty2} stroke={INK} strokeWidth="2" />
        <text x={cx} y={cy + 4} textAnchor="middle" className="nova-svg-lg" fill={INK}>{d.value.toFixed(1)}%</text>
        <text x={cx} y={cy + 20} textAnchor="middle" className="nova-svg-xs" fill={INK_MUTED}>target {d.target}%</text>
      </svg>
      <div className="min-w-0 flex-1">
        <TrendLine d={{ shape: 'trend', x: d.trend.x, series: [{ name: 'Compliance', values: d.trend.values }], target: d.target, n: d.n, headline: d.headline }} compact />
      </div>
    </div>
  );
}

/* ── DotTimeline ────────────────────────────────────────────────────────── */
export function DotTimeline({ d, onPick }: { d: Extract<ChartData, { shape: 'timeline' }>; onPick?: (label: string) => void }) {
  const W = 480; const H = 120; const padL = 14; const padR = 14; const axisY = 78;
  const x = (v: number) => padL + ((W - padL - padR) * v) / d.months.length;
  const r = (s: string) => (s === 'high' ? 7 : s === 'medium' ? 5 : 4);
  const fill = (s: string) => (s === 'high' ? BAD : s === 'medium' ? WARN : 'var(--nova-g500)');
  return (
    <div data-dot-timeline>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="presentation" className="nova-svg">
        <line x1={padL} x2={W - padR} y1={axisY} y2={axisY} stroke={RULE} strokeWidth="1.5" />
        {d.months.map((m, i) => (
          <text key={m} x={x(i + 0.5)} y={axisY + 18} textAnchor="middle" className="nova-svg-xs" fill={INK_MUTED}>{m}</text>
        ))}
        {d.events.map((e, i) => {
          /* A NAMED EVENT IS A TARGET. Not a <button> — an SVG group with the button role, so a
             card that may render no buttons can still let a dot open its record. */
          const hit = onPick && e.named;
          return (
            <g
              key={e.id}
              data-severity={e.severity}
              data-event={e.id}
              className={hit ? 'nova-dot-pick' : undefined}
              role={hit ? 'button' : undefined}
              tabIndex={hit ? 0 : undefined}
              aria-label={hit ? `Open ${e.id}` : undefined}
              onClick={hit ? () => onPick!(e.id) : undefined}
              onKeyDown={hit ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick!(e.id); } } : undefined}
            >
              <circle cx={x(e.x)} cy={axisY - (i % 2 ? 16 : 30)} r={r(e.severity)} fill={fill(e.severity)} stroke="#fff" strokeWidth="2">
                <title>{`${e.label} · ${e.severity} severity`}</title>
              </circle>
              {e.named && (
                <text x={x(e.x)} y={axisY - (i % 2 ? 16 : 30) - 11} textAnchor="middle" className="nova-svg-xs" fill={INK}>{e.id}</text>
              )}
            </g>
          );
        })}
      </svg>
      {new Set(d.events.map((e) => e.severity)).size > 1 && (
      <p className="mt-1 flex flex-wrap gap-x-3 ask-text-xs text-[var(--nova-ink-muted)]" data-legend>
        {(['high', 'medium', 'low'] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block rounded-full" style={{ width: r(s) * 2, height: r(s) * 2, background: fill(s) }} />
            {s} severity
          </span>
        ))}
      </p>
      )}
    </div>
  );
}

/* ── DeadlineList ───────────────────────────────────────────────────────── */
export function DeadlineList({ d, onPick }: { d: Extract<ChartData, { shape: 'deadlines' }>; onPick?: (ref: string) => void }) {
  return (
    <ul className="space-y-1" data-deadline-list>
      {d.rows.map((r) => {
        const overdue = r.dueDays < 0;
        const pct = overdue ? 100 : Math.max(4, Math.min(100, 100 - (r.dueDays / r.windowDays) * 100));
        const Row: 'button' | 'div' = onPick ? 'button' : 'div';
        return (
          <li key={r.ref}>
            <Row
              {...(onPick ? { type: 'button' as const, onClick: () => onPick(r.ref) } : {})}
              className={`nova-deadline ${overdue ? 'nova-deadline-overdue' : ''} ${onPick ? 'nova-btn cursor-pointer hover:bg-[var(--nova-surface-hover)]' : ''}`}
              data-overdue={overdue ? 'true' : 'false'}
            >
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="nova-t-label">{r.ref}</span>
                <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{r.title}</span>
                <span className="nova-t-meta">· {r.owner}</span>
                <span className={`ml-auto ask-text-sm ${overdue ? 'ask-w-500 text-[var(--nova-error)]' : 'text-[var(--nova-ink-muted)]'}`}>
                  {overdue ? `Overdue by ${-r.dueDays} day${-r.dueDays === 1 ? '' : 's'}` : `Due in ${r.dueDays} day${r.dueDays === 1 ? '' : 's'}`}
                </span>
              </span>
              <span className="nova-rank-track mt-1.5 block" aria-hidden="true">
                <span className={`nova-rank-bar ${overdue ? 'nova-rank-bar-neg' : r.dueDays <= 7 ? 'nova-rank-bar-warn' : ''}`} style={{ width: `${pct}%` }} />
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

/* ── ImpactMatrix ───────────────────────────────────────────────────────── */
export function ImpactMatrix({ d, onPick }: { d: Extract<ChartData, { shape: 'matrix' }>; onPick?: (label: string) => void }) {
  const W = 480; const H = 230; const padL = 34; const padR = 14; const padT = 14; const padB = 30;
  const xMax = 10; const yMax = Math.max(...d.points.map((p) => p.y)) * 1.15;
  const sMax = Math.max(...d.points.map((p) => p.size), 1);
  const x = (v: number) => padL + ((W - padL - padR) * v) / xMax;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / yMax);
  const midX = x(xMax / 2); const midY = y(yMax / 2);
  return (
    <div data-impact-matrix>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="presentation" className="nova-svg">
        <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} fill="var(--nova-surface-subtle)" stroke={RULE} />
        <line x1={midX} x2={midX} y1={padT} y2={H - padB} stroke={RULE} strokeDasharray="4 4" />
        <line x1={padL} x2={W - padR} y1={midY} y2={midY} stroke={RULE} strokeDasharray="4 4" />
        <text x={padL + 6} y={padT + 14} className="nova-svg-xs" fill={INK_FAINT}>Fix now</text>
        <text x={W - padR - 6} y={padT + 14} textAnchor="end" className="nova-svg-xs" fill={INK_FAINT}>Plan properly</text>
        <text x={padL + 6} y={H - padB - 6} className="nova-svg-xs" fill={INK_FAINT}>Quick wins</text>
        <text x={W - padR - 6} y={H - padB - 6} textAnchor="end" className="nova-svg-xs" fill={INK_FAINT}>Later</text>
        <text x={W / 2} y={H - 8} textAnchor="middle" className="nova-svg-xs" fill={INK_MUTED}>{d.xLabel}</text>
        <text x={12} y={H / 2} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`} className="nova-svg-xs" fill={INK_MUTED}>{d.yLabel}</text>
        {d.points.map((p, i) => (
          <g key={p.id} className={onPick ? 'cursor-pointer' : undefined} onClick={onPick ? () => onPick(p.label) : undefined}>
            <circle cx={x(p.x)} cy={y(p.y)} r={8 + 18 * Math.sqrt(p.size / sMax)} fill={SERIES[i % SERIES.length]} opacity="0.75" stroke="#fff" strokeWidth="2">
              <title>{`${p.label} · ${p.sizeLabel} · recurrence ${p.y} · effort ${p.x}/10`}</title>
            </circle>
            <text x={x(p.x)} y={y(p.y) - 8 - 18 * Math.sqrt(p.size / sMax) - 3} textAnchor="middle" className="nova-svg-xs" fill={INK}>
              {p.label.length > 26 ? `${p.label.slice(0, 25)}…` : p.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 ask-text-xs text-[var(--nova-ink-muted)]">Bubble size = {d.points[0]?.sizeLabel.split(' ').slice(1).join(' ') || 'hours'}</p>
    </div>
  );
}

/* ── Sparkline (problem cards) ──────────────────────────────────────────── */
function Sparkline({ values, color }: { values: readonly number[]; color: string }) {
  const W = 120; const H = 28; const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 3 - (v / max) * (H - 6)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Twelve-week trend, ${values.join(', ')}`}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

/* ── the three named incidents, one line each ───────────────────────────── */
export function IncidentCards() {
  return (
    <ul className="space-y-2" data-incident-cards>
      {SECURITY.named.map((n) => (
        <li key={n.id} className="rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface-subtle)] px-4 py-2.5">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="nova-t-label">{n.id} · {n.month}</span>
            <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{n.title}</span>
          </p>
          <p className="nova-t-meta mt-0.5">{n.what} · {n.contained} · {n.impact}</p>
        </li>
      ))}
    </ul>
  );
}

/* ── one incident, in detail (CXO-05 chip 1) ────────────────────────────── */
export function IncidentDetail({ id }: { id: string }) {
  const n = SECURITY.named.find((x) => x.id === id) ?? SECURITY.named[0];
  const timeline = [
    ['09:12', 'Detected — mail gateway flagged a credential-harvest domain'],
    ['09:40', 'Two accounts confirmed compromised; sessions revoked'],
    ['13:05', 'Contained — domain blocked, passwords reset, MFA re-enrolled'],
    ['16:40', 'Recovered — mailbox rules audited, no data left the estate'],
  ];
  return (
    <div className="rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface-subtle)] px-4 py-3" data-incident-detail>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="nova-t-label">{n.id} · {n.month}</span>
        <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{n.title}</span>
      </p>
      <ol className="mt-2 space-y-1">
        {timeline.map(([t, s]) => (
          <li key={t} className="flex gap-3 ask-text-sm">
            <span className="w-10 flex-shrink-0 tabular-nums text-[var(--nova-ink-muted)]">{t}</span>
            <span className="text-[var(--nova-ink)]">{s}</span>
          </li>
        ))}
      </ol>
      <p className="nova-t-meta mt-2">Accounts affected: {n.what}. Controls added since: link isolation on inbound mail, MFA number-matching, quarterly phishing drills.</p>
    </div>
  );
}

/* ── the recurring-problem cards (CXO-06) ───────────────────────────────── */
export function ProblemCards({ onAsk }: { onAsk: (q: string) => void }) {
  const ask: Record<string, string> = {
    vpn: 'Raise a problem record for the VPN one',
    printer: 'Raise a problem record for the printer one',
    mailbox: 'Raise a problem record for the mailbox one',
  };
  return (
    <ul className="space-y-2" data-problem-cards>
      {PROBLEMS.map((p, i) => (
        <li key={p.id} className="rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface-subtle)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="min-w-0 flex-1 nova-t-body ask-w-500 text-[var(--nova-ink)]">{p.name}</p>
            <Sparkline values={p.weekly} color={SERIES[i % SERIES.length]} />
          </div>
          <p className="nova-t-meta mt-1">{p.tickets} tickets · {p.hours} hours · {p.teams} teams · fix: {p.fix}</p>
          <button type="button" className="nova-btn nova-hit nova-tertiary -ml-1 mt-1" onClick={() => onAsk(ask[p.id])}>
            Raise a problem record
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── the chart body, by kind — shared by the frame and the dashboard tiles ── */
type Kind = 'bars' | 'grouped' | 'line' | 'table' | 'gauge' | 'timeline' | 'list' | 'matrix';

const KINDS_FOR: Record<ChartData['shape'], Kind[]> = {
  comparison: ['grouped', 'line', 'table'],
  ranking: ['bars', 'table'],
  trend: ['line', 'bars', 'table'],
  gauge: ['gauge', 'table'],
  timeline: ['timeline', 'table'],
  deadlines: ['list', 'table'],
  matrix: ['matrix', 'bars', 'table'],
  table: ['table'],
};
/* One word each: these are PILLS now, shown all at once, so the label only has to name the
   shape — "Show as table" was a dropdown option describing its own effect. */
const KIND_LABEL: Record<Kind, string> = {
  bars: 'Bars', grouped: 'Grouped', line: 'Line', table: 'Table',
  gauge: 'Gauge', timeline: 'Timeline', list: 'List', matrix: 'Matrix',
};

/** WHAT BUILT THIS VISUAL — read off the resolved dataset, never authored a second time.
 *
 *  The chips under the pills answer "where do these bars come from": what is being measured, how
 *  many records it was computed over, and as of when. A reader who cannot see the dimensions
 *  behind a chart has to take it on faith, and this module's whole argument is that they should
 *  not have to. */
export function chartDimensions(d: ChartData): Array<{ name: string; value: string }> {
  const dims: Array<{ name: string; value: string }> = [];
  switch (d.shape) {
    case 'comparison':
      dims.push({ name: 'Series', value: d.series.map((s) => s.name).join(', ') });
      dims.push({ name: 'Categories', value: String(d.categories.length) });
      break;
    case 'ranking':
      dims.push({ name: 'Measure', value: d.unit ?? 'value' });
      dims.push({ name: 'Rows', value: String(d.rows.length) });
      break;
    case 'trend':
      dims.push({ name: 'Series', value: d.series.map((s) => s.name).join(', ') });
      dims.push({ name: 'Points', value: `${d.x.length} · ${d.x[0]}–${d.x[d.x.length - 1]}` });
      if (d.target !== undefined) dims.push({ name: 'Target', value: String(d.target) });
      break;
    case 'gauge':
      dims.push({ name: 'Measure', value: 'SLA compliance' });
      dims.push({ name: 'Target', value: `${d.target}%` });
      dims.push({ name: 'Trend', value: `${d.trend.x.length} months` });
      break;
    case 'timeline':
      dims.push({ name: 'Events', value: String(d.events.length) });
      dims.push({ name: 'Range', value: `${d.months[0]}–${d.months[d.months.length - 1]}` });
      break;
    case 'deadlines':
      dims.push({ name: 'Deadlines', value: String(d.rows.length) });
      dims.push({ name: 'Window', value: `${d.rows[0]?.windowDays ?? 0} days` });
      break;
    case 'matrix':
      dims.push({ name: 'X', value: d.xLabel });
      dims.push({ name: 'Y', value: d.yLabel });
      dims.push({ name: 'Points', value: String(d.points.length) });
      break;
    case 'table':
      dims.push({ name: 'Columns', value: d.columns.join(', ') });
      dims.push({ name: 'Rows', value: String(d.rows.length) });
      break;
  }
  return dims;
}

/** Close a popover on a click outside it or on Escape. Both controls below want exactly this
 *  and nothing else, so it is one hook rather than two copies of the same four lines. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      /* The drawer listens for Escape too, and it would close the whole conversation behind a
         menu the reader was only trying to dismiss. */
      e.stopPropagation();
      close();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key, true); };
  }, [open, close]);
  return ref;
}

/** A row of pills — every option visible, the chosen one filled.
 *
 *  ⚠️ THE TECHNICIAN'S FRAME ONLY. The CXO card moved these into the ••• menu; this one did not,
 *  because that reorganisation was scoped to CXO. A technician reads a chart inside a dense
 *  answer they are working from, not presenting from, and the pills put every option on screen
 *  at once — which is the right trade at that density and the wrong one at CXO's. */
function PillRow({ label, options, active, onPick }: {
  label: string;
  options: Array<{ id: string; label: string }>;
  active: string | undefined;
  onPick: (id: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <div className="nova-chart-pills" role="group" aria-label={label} data-pill-row={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="nova-chart-pill"
          aria-pressed={active === o.id}
          data-pill={o.id}
          onClick={() => onPick(o.id)}
        >{o.label}</button>
      ))}
    </div>
  );
}

const MENU_ITEM = 'nova-btn flex w-full items-center gap-2.5 px-3 py-[7px] text-left ask-text-sm text-[var(--nova-ink)] hover:bg-[var(--nova-surface-hover)]';

/** ⋯ — CHART TYPE · DATA FILTER · EXPAND · EXPORT.
 *
 * These were four rows of chrome wrapped around one picture: a chart-type pill row, a group-by
 * pill row, an expand button and a regenerate button, all of them permanently on screen above a
 * visual nobody opened the drawer to reconfigure. Every option is still here and still one
 * click away — it is the PERMANENCE that went, not the control.
 *
 * ⚠️ ONE LEVEL OF SUBMENU, and the back row names where you are. A reader who opens "Chart type"
 * and changes their mind must be able to get back without closing and starting again — the
 * response menu (`ResponseUtilityBar`) does exactly this, and this is deliberately the same
 * shape rather than a second menu language. */
type Flyout = 'kind' | 'filter' | 'export';

/** One row of the root menu that opens a panel beside it. Hover opens it, click opens it, and
 *  the row stays lit while its panel is up — so the reader can always see where they are. */
function FlyoutRow({ id, icon, label, open, onOpen, children }: {
  id: Flyout;
  icon: ReactNode;
  label: string;
  open: boolean;
  onOpen: (id: Flyout | null) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={() => onOpen(id)}>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${MENU_ITEM} ${open ? 'bg-[var(--nova-surface-hover)]' : ''}`}
        data-menu-open={id}
        onClick={() => onOpen(open ? null : id)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onOpen(open ? null : id); }
        }}
      >
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight size={13} aria-hidden="true" className="text-[var(--nova-ink-faint)]" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          data-chart-submenu={id}
          /* ⚠️ OPENS LEFT. This menu sits at the right edge of a ~420px drawer, so a panel opening
             rightward would start off-screen. `top-[-4px]` lines its first row up with the row
             that opened it, the way the reference does. */
          className="absolute right-full top-[-4px] z-40 mr-1 w-44 rounded-lg border border-[var(--nova-rule)] bg-white py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** ⋯ — CHART TYPE · DATA FILTER · FULL SCREEN · EXPORT.
 *
 * These were four rows of chrome wrapped around one picture: a chart-type pill row, a group-by
 * pill row, an expand button and a regenerate button, all of them permanently on screen above a
 * visual nobody opened the drawer to reconfigure. Every option is still here and still one click
 * away — it is the PERMANENCE that went, not the control.
 *
 * ── THE SUBMENU IS A PANEL BESIDE IT, NOT A REPLACEMENT ─────────────────────────────────────
 * The first version swapped the root's contents for the submenu and offered a back row. That is
 * navigation, and a menu four items long does not need navigating: the reader loses sight of
 * what else was on offer to look at one branch of it. A flyout keeps both on screen, which is
 * what the product's own menus do.
 */
function ChartMenu({ kinds, kind, onKind, groups, group, onGroup, onExpand, expanded, onExportImage, onExportCsv, onExportPdf, onEmailPdf }: {
  kinds: Array<{ id: string; label: string }>;
  kind: string;
  onKind: (id: string) => void;
  groups: Array<{ id: string; label: string }>;
  group: string | undefined;
  onGroup: (id: string) => void;
  onExpand: () => void;
  expanded: boolean;
  onExportImage: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onEmailPdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fly, setFly] = useState<Flyout | null>(null);
  const close = useCallback(() => { setOpen(false); setFly(null); }, []);
  const ref = useDismiss(open, close);
  const hasKinds = kinds.length > 1;
  const hasGroups = groups.length > 1;

  const choice = (id: string, label: string, active: boolean, pick: () => void) => (
    <button key={id} type="button" role="menuitemradio" aria-checked={active}
      className={`${MENU_ITEM} ${active ? 'ask-w-500 text-[var(--nova-primary)]' : ''}`}
      data-menu-choice={id} onClick={() => { pick(); close(); }}>
      <span className="flex-1">{label}</span>
      {active && <Check size={13} aria-hidden="true" className="text-[var(--nova-primary)]" />}
    </button>
  );
  const act = (attr: string, label: string, run: () => void) => (
    <button type="button" role="menuitem" className={MENU_ITEM} data-export={attr}
      onClick={() => { run(); close(); }}>{label}</button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Visual controls"
        title="Visual controls"
        aria-haspopup="menu"
        aria-expanded={open}
        className="nova-btn nova-btn-icon nova-hit flex size-7 items-center justify-center rounded"
        data-chart-menu-btn
        onClick={() => (open ? close() : setOpen(true))}
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Visual controls" data-chart-menu
          className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-[var(--nova-rule)] bg-white py-1 shadow-lg">
          {hasKinds && (
            <FlyoutRow id="kind" open={fly === 'kind'} onOpen={setFly}
              icon={<BarChart3 size={13} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />}
              label="Chart type">
              {kinds.map((k) => choice(k.id, k.label, k.id === kind, () => onKind(k.id)))}
            </FlyoutRow>
          )}
          {hasGroups && (
            <FlyoutRow id="filter" open={fly === 'filter'} onOpen={setFly}
              icon={<Filter size={13} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />}
              label="Data filter">
              {groups.map((g) => choice(g.id, g.label, g.id === group, () => onGroup(g.id)))}
            </FlyoutRow>
          )}
          {/* Hovering a plain row must close whichever panel is open, or a flyout hangs beside a
              row it does not belong to. */}
          <div onMouseEnter={() => setFly(null)}>
            <button type="button" role="menuitem" className={MENU_ITEM} data-menu-expand
              onClick={() => { onExpand(); close(); }}>
              {expanded ? <Minimize2 size={13} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />
                : <Maximize2 size={13} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />}
              {expanded ? 'Exit full screen' : 'Full screen'}
            </button>
            <div className="my-1 border-t border-[var(--nova-rule)]" aria-hidden="true" />
          </div>
          <FlyoutRow id="export" open={fly === 'export'} onOpen={setFly}
            icon={<Download size={13} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />}
            label="Export">
            {act('image', 'Image', onExportImage)}
            {act('pdf', 'PDF', onExportPdf)}
            {act('csv', 'Data (CSV)', onExportCsv)}
            <div className="my-1 border-t border-[var(--nova-rule)]" aria-hidden="true" />
            {act('email', 'Email as PDF', onEmailPdf)}
          </FlyoutRow>
        </div>
      )}
    </div>
  );
}

/** ⓘ — WHAT BUILT THIS VISUAL.
 *
 * The dimensions and the data basis used to be two visible rows: a strip of chips above the
 * chart and a "Based on N tickets · data as of …" line below it. Both are true and neither is
 * what the reader came for — they are what you check ONCE, when you doubt the picture. So they
 * are one click away rather than permanently in the way.
 *
 * ⚠️ NOTHING IN HERE IS AUTHORED. Every row is read off the resolved dataset (`chartDimensions`
 * switches on the data's own shape, so an SLA gauge lists its target and a ranking lists its
 * measure), which is why the panel cannot describe a chart the reader is not looking at. */
function ChartInfo({ dims, basis }: { dims: Array<{ name: string; value: string }>; basis: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        aria-label="About this visual"
        title="About this visual"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="nova-btn nova-btn-icon nova-hit flex size-6 items-center justify-center rounded-full"
        data-chart-info-btn
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label="About this visual" data-chart-info
          className="absolute bottom-full right-0 z-30 mb-1 w-60 rounded-lg border border-[var(--nova-rule)] bg-white p-3 shadow-lg">
          <dl className="nova-chart-info-list">
            {dims.map((x) => (
              <div key={x.name} data-info-row={x.name}>
                <dt>{x.name}</dt>
                <dd>{x.value}</dd>
              </div>
            ))}
            <div data-info-row="Data basis">
              <dt>Data basis</dt>
              <dd>{basis}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

export function ChartBody({ d, kind, onPick }: { d: ChartData; kind: Kind; onPick?: (label: string) => void }) {
  if (kind === 'table') return <DataTable {...toTable(d)} onRow={onPick ? (r) => onPick(String(r[0])) : undefined} />;
  switch (d.shape) {
    case 'comparison':
      return kind === 'line'
        ? <TrendLine d={{ shape: 'trend', x: d.categories, series: d.series, n: d.n, headline: d.headline }} onPick={onPick} />
        : <ComparisonBars d={d} onPick={onPick} />;
    case 'ranking': return <RankedBars d={d} onPick={onPick} />;
    case 'trend':
      return kind === 'bars'
        ? <RankedBars d={{ shape: 'ranking', rows: d.x.map((x, i) => ({ label: x, value: d.series[0].values[i] })), unit: d.series[0].name, n: d.n, headline: d.headline }} />
        : <TrendLine d={d} onPick={onPick} />;
    case 'gauge': return <Gauge d={d} />;
    case 'timeline': return <DotTimeline d={d} onPick={onPick} />;
    case 'deadlines': return <DeadlineList d={d} onPick={onPick} />;
    case 'matrix':
      return kind === 'bars'
        ? <RankedBars d={{ shape: 'ranking', rows: d.points.map((p) => ({ label: p.label, value: p.size, display: p.sizeLabel })), n: d.n, headline: d.headline }} onPick={onPick} />
        : <ImpactMatrix d={d} onPick={onPick} />;
    case 'table': return <DataTable columns={d.columns} rows={d.rows} onRow={onPick ? (r) => onPick(String(r[0])) : undefined} />;
  }
}

/* ── ChartFrame — the container EVERY chart lives in ────────────────────── */
type ChartBlock = Extract<RequesterBlock, { w: 'chart' }>;

export function ChartFrame({ block, segment, forceTable, onAsk, compact, onPickRef }: {
  block: ChartBlock;
  /** `pick: 'open'` — a named mark OPENS its record, as a navigate action. */
  onPickRef?: (ref: string) => void;
  /** Technician answers: the reduced toolbar — group by and a table toggle only; no dashboard,
   *  no expand, no regenerate. Same component. */
  compact?: boolean;
  /** A drill turn's segment (from context.filter) — used as the dataset's group-by. */
  segment?: string;
  /** The turn's ••• "Show as table" — every frame in the turn becomes its table. */
  forceTable?: boolean;
  onAsk: (q: string, context?: Record<string, unknown>) => void;
}) {
  const reduced = prefersReducedMotion();
  const [groupBy, setGroupBy] = useState<string | undefined>(segment ?? block.groupBy?.[0]?.id);
  /* Subscribed to the store: a technician dataset reflects this session's changes. */
  const store = useTicketStore();
  const data = useMemo(() => dataset(block.data, groupBy), [block.data, groupBy, store]);
  const kinds = (block.kinds ?? KINDS_FOR[data.shape]).filter((k) => KINDS_FOR[data.shape].includes(k));
  const [kind, setKind] = useState<Kind>(kinds[0]);
  const [anim, setAnim] = useState(0);
  const [fresh, setFresh] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dash, setDash] = useState<'closed' | 'pick' | 'sheet'>('closed');
  const [added, setAdded] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<string[]>([]);
  const frameRef = useRef<HTMLElement | null>(null);
  const effKind: Kind = forceTable ? 'table' : kind;

  /* Draw-in on FIRST render only; a group-by switch crossfades; reduced motion gets neither. */
  useEffect(() => { const t = window.setTimeout(() => setFresh(false), 450); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!expanded) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setExpanded(false); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [expanded]);
  useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(null), 3000);
    return () => clearTimeout(t);
  }, [added]);

  /* `regenerate` is gone with the toolbar. It cycled to the NEXT chart type without saying
     which — a control whose outcome the reader could not predict — and "Chart type ▸" in the
     menu now names every option and marks the current one. */
  const pickKind = (k: string) => {
    if (forceTable) return;
    setKind(k as Kind);
    setAnim((a) => a + 1);
  };

  const drill = block.drill ? (label: string) => {
    setCrumbs((c) => [...c, label]);
    onAsk(label, { caseId: block.drill!.case, filter: { segment: label, data: block.data } });
  } : block.pick === 'open' && onPickRef ? (label: string) => {
    /* The label a mark hands back is its own id for a timeline, and the first cell for a table
       row; either way the reference is what opens. */
    const ref = label.match(/\b((?:INC|REQ|PRB|CHG|KB)-\d{3,5})\b/i)?.[1].toUpperCase();
    if (ref) onPickRef(ref);
  } : undefined;

  /* Back in the breadcrumb SCROLLS — to this frame's turn, or to the drilled turn — it never
     deletes a turn. */
  const go = (i: number) => {
    if (i === 0) { frameRef.current?.closest('article')?.scrollIntoView({ block: 'start' }); return; }
    const label = crumbs[i - 1];
    const target = [...document.querySelectorAll('.nova-drawer article')]
      .find((a) => (a.querySelector('.nova-said-box')?.textContent ?? '').trim() === label);
    (target ?? frameRef.current)?.scrollIntoView({ block: 'start' });
  };

  const body = (
    <div key={`${groupBy}-${anim}-${effKind}`} className={reduced ? undefined : fresh ? 'nova-chart-in' : 'nova-xfade'} data-chart-kind={effKind}>
      <ChartBody d={data} kind={effKind} onPick={drill} />
    </div>
  );

  const frame = (
    <section
      ref={frameRef}
      className={`nova-chart-frame ${expanded ? 'nova-chart-expanded' : ''}`}
      aria-label={data.headline}
      /* THE FRAME'S OWN CHROME. Every control in here reconfigures this picture and nothing
         else — it never leaves the element, so it is not a forward action. */
      data-in-element="chart"
      data-chart-frame={block.id}
      data-expanded={expanded ? 'true' : 'false'}
      data-compact={compact ? 'true' : 'false'}
    >
      {/* ── LINE 1 · the title in its own band, one action, and the rest behind ••• ──────
          THE HEADER SITS ON THE TINT and the visual below it on white — the product's own card
          shape (`.nova-card-head` does the same for the draft card), and it is what makes a
          chart read as a titled object rather than as a caption with a picture under it. */}
      <div className="nova-chart-head" data-chart-toolbar>
        <p className="nova-chart-title nova-t-label">{block.title}</p>
        {!compact && (
          <div className="relative">
            <button type="button" aria-haspopup="dialog" aria-expanded={dash === 'pick'}
              className="nova-btn nova-hit nova-tertiary" onClick={() => setDash((d) => (d === 'pick' ? 'closed' : 'pick'))}
              title="Add to dashboard" data-add-dashboard>
              <LayoutDashboard size={12} aria-hidden="true" />
              {/* THE WORDS GO FIRST WHEN THE COLUMN IS NARROW, not the button. The glyph and its
                  tooltip carry it, and the control keeps its place and its hit area. */}
              <span className="nova-chart-addlabel">Add to dashboard</span>
            </button>
            {dash === 'pick' && (
              <AddToDashboard
                defaultTitle={block.title}
                onCancel={() => setDash('closed')}
                onAdd={(dashboardId, title) => {
                  const d = addTile(dashboardId, {
                    title, headline: data.headline, freshness: freshness(data.n),
                    chart: { data: block.data, groupBy, kind: effKind },
                  });
                  setDash('closed');
                  setAdded(d?.name ?? null);
                }}
              />
            )}
          </div>
        )}
        {/* ⚠️ THE MENU IS THE CXO CARD'S. The technician's frame keeps the pills below — see
            PillRow — because that reorganisation was scoped to CXO. */}
        {!compact && (
          <ChartMenu
            kinds={kinds.map((k) => ({ id: k, label: KIND_LABEL[k] }))}
            kind={effKind}
            onKind={pickKind}
            groups={block.groupBy ?? []}
            group={groupBy}
            onGroup={setGroupBy}
            onExpand={() => setExpanded((v) => !v)}
            expanded={expanded}
            onExportImage={() => exportImage(frameRef.current, `${block.export?.replace(/\.csv$/, '') ?? block.id}.png`)}
            onExportCsv={() => downloadCsv(block.export ?? `${block.id}.csv`, toCsv(toTable(data)))}
            onExportPdf={() => exportPdf(frameRef.current, block.title, data.headline, freshness(data.n))}
            onEmailPdf={() => emailPdf(frameRef.current, block.title, data.headline, freshness(data.n))}
          />
        )}
      </div>

      <div className="nova-chart-body">
        {/* THE TECHNICIAN'S CONTROLS, UNCHANGED. Every option on screen, the chosen one filled —
            the right trade at a technician's density, and the one the CXO card moved into its
            menu. Out of scope here by instruction, and the same component either way. */}
        {compact && (
          <div className="mt-1.5 space-y-1">
            <PillRow
              label="Chart type"
              options={kinds.map((k) => ({ id: k, label: KIND_LABEL[k] }))}
              active={effKind}
              onPick={pickKind}
            />
            <PillRow
              label="Group by"
              options={(block.groupBy ?? []).map((g) => ({ id: g.id, label: g.label }))}
              active={groupBy}
              onPick={(g) => setGroupBy(g)}
            />
          </div>
        )}
        {compact && (
          <p className="nova-chart-dims" data-chart-dims>
            {chartDimensions(data).map((x) => (
              <span key={x.name} className="nova-chart-dim" data-dim={x.name}>
                <b>{x.name}</b> = <span>{x.value}</span>
              </span>
            ))}
          </p>
        )}

        {/* The drill path is NAVIGATION, not metadata — it says where the reader is, so it stays
            above the thing it navigated to. */}
        {crumbs.length > 0 && <div className="mt-1"><Breadcrumb crumbs={crumbs} onGo={go} /></div>}

        {/* ── LINE 2 · the visual, which is what the card is for ─────────────────────────── */}
        <div className="mt-2">{body}</div>

        {/* ── LINE 3 · what it MEANS, and the way to what built it ─────────────────────────
            `data.headline` is the dataset's own one-line reading, and it was already on this card
            — as the frame's aria-label, which only a screen reader ever met. Printed here it is
            the sentence the eye lands on after the picture: visual → what it means.
            The technician's frame keeps its freshness line instead, as it always had. */}
        {compact ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ask-text-xs text-[var(--nova-ink-faint)]" data-freshness>
            <span>{freshness(data.n)}</span>
            {block.export && (
              <button type="button" className="nova-btn nova-hit nova-tertiary" onClick={() => downloadCsv(block.export!, toCsv(toTable(data)))}>
                <Download size={11} aria-hidden="true" />
                Export
              </button>
            )}
          </p>
        ) : (
          <div className="nova-chart-foot" data-chart-foot>
            <p className="nova-chart-summary" data-chart-summary>{data.headline}</p>
            {added && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 ask-text-xs text-[var(--nova-success)]" role="status" data-added>
                <Check size={11} aria-hidden="true" />
                Added to {added} ·
                <button type="button" className="nova-btn underline" onClick={() => setDash('sheet')}>View</button>
              </span>
            )}
            <ChartInfo dims={chartDimensions(data)} basis={freshness(data.n)} />
          </div>
        )}
      </div>

      {dash === 'sheet' && <NovaDashboardSheet onClose={() => setDash('closed')} />}
    </section>
  );

  return expanded ? createPortal(frame, document.body) : frame;
}

function AddToDashboard({ defaultTitle, onAdd, onCancel }: {
  defaultTitle: string; onAdd: (dashboardId: string, title: string) => void; onCancel: () => void;
}) {
  const { dashboards } = useTicketStore();
  const [pick, setPick] = useState(dashboards[0]?.id ?? 'exec');
  const [title, setTitle] = useState(defaultTitle);
  return (
    <div role="dialog" aria-label="Add to dashboard" className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-[var(--nova-rule)] bg-white p-3 shadow-lg" data-dashboard-popover>
      <p className="nova-t-label">Add to dashboard</p>
      <div className="mt-2 space-y-1" role="radiogroup" aria-label="Dashboard">
        {dashboards.map((d) => (
          <label key={d.id} className="flex cursor-pointer items-center gap-2 ask-text-sm text-[var(--nova-ink)]">
            <input type="radio" name="dash" value={d.id} checked={pick === d.id} onChange={() => setPick(d.id)} className="accent-[var(--nova-action)]" />
            {d.name}
          </label>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="Tile title"
        className="mt-2 h-8 w-full rounded border border-[var(--nova-rule)] bg-white px-2 ask-text-sm text-[var(--nova-ink)] outline-none focus:border-[var(--nova-primary)]"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" className="nova-btn nova-btn-primary inline-flex h-8 items-center rounded px-3 ask-text-sm ask-w-500 disabled:opacity-40" disabled={!title.trim()} onClick={() => onAdd(pick, title.trim())}>Add tile</button>
        <button type="button" className="nova-btn nova-btn-ghost inline-flex h-8 items-center rounded px-2 ask-text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ── the dashboard view — the proof that "+ dashboard" did something ───── */
export function NovaDashboardSheet({ onClose }: { onClose: () => void }) {
  const { dashboards } = useTicketStore();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  return createPortal(
    <aside className="nova-ev-sheet" role="dialog" aria-modal="true" aria-label="Dashboards" data-dashboard-sheet>
      <header className="flex items-start gap-2 border-b border-[var(--nova-rule)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="ask-text-base ask-w-600 text-[var(--nova-ink)]">Dashboards</h3>
          <p className="nova-t-meta mt-0.5">Tiles added from Nova — static snapshots, removable.</p>
        </div>
        <button type="button" aria-label="Close dashboards" onClick={onClose} className="nova-btn nova-btn-icon flex size-8 items-center justify-center rounded">
          <X size={15} aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {dashboards.map((d) => (
          <section key={d.id} className="mb-4" data-dashboard={d.id}>
            <p className="nova-t-label">{d.name} · {d.tiles.length} tile{d.tiles.length === 1 ? '' : 's'}</p>
            {d.tiles.length === 0 ? (
              <p className="nova-t-meta mt-1">Nothing here yet.</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2">
                {d.tiles.map((t) => <Tile key={t.id} tile={t} onRemove={() => removeTile(d.id, t.id)} />)}
              </div>
            )}
          </section>
        ))}
      </div>
    </aside>,
    document.body,
  );
}

function Tile({ tile, onRemove }: { tile: DashboardTile; onRemove: () => void }) {
  const d = useMemo(() => dataset(tile.chart.data, tile.chart.groupBy), [tile.chart.data, tile.chart.groupBy]);
  return (
    <div className="rounded-lg border border-[var(--nova-rule)] bg-white p-3" data-tile aria-label={tile.headline}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 nova-t-body ask-w-500 text-[var(--nova-ink)]">{tile.title}</p>
        <button type="button" className="nova-btn nova-hit nova-tertiary" onClick={onRemove} aria-label={`Remove ${tile.title}`}>Remove</button>
      </div>
      <div className="mt-2"><ChartBody d={d} kind={tile.chart.kind as Kind} /></div>
      <p className="mt-2 ask-text-xs text-[var(--nova-ink-faint)]">{tile.freshness}</p>
    </div>
  );
}

/** For the ••• menu: the turn's PRIMARY dataset (its first chart block) as CSV. */
export function primaryCsv(blocks: RequesterBlock[] | undefined, segment?: string): { csv: string; data: string } | null {
  const c = blocks?.find((b): b is ChartBlock => b.w === 'chart');
  if (!c) return null;
  return { csv: toCsv(toTable(dataset(c.data, segment ?? c.groupBy?.[0]?.id))), data: c.data };
}

export const kpisFor = (set: string, segment?: string): KpiSpec[] => kpis(set, segment);
export type { ReactNode };
