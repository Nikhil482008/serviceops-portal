/* Markdown for the docked panel.
 *
 * Hand-rolled rather than a dependency. Two reasons, in this order:
 *
 *  1. SAFETY. Assistant output is untrusted. Everything below builds React ELEMENTS — there is no
 *     `dangerouslySetInnerHTML` anywhere in this file, so there is no path from model output to
 *     injected HTML. A library that renders to elements gives the same guarantee; one that renders
 *     to an HTML string does not, and the distinction is easy to lose in a bundle upgrade.
 *  2. This repo has no markdown dependency and deliberately few dependencies. Adding two for a
 *     panel that renders headings, lists, tables and code was not worth it.
 *
 * Supported, because the answers use them: headings, bold, italic, inline code, fenced code with
 * a copy button, unordered and ordered lists, GFM tables, blockquotes, and links. NOT supported:
 * nested lists, images, HTML passthrough, reference links, footnotes. Anything unrecognised
 * renders as the literal text it came in as, which is the safe failure — a paragraph that shows
 * its own asterisks is legible; a swallowed line is not.
 *
 * Note this is a SEPARATE renderer from `AiMarkdown`'s `renderAiText`. That one is the ticket
 * panel's, handles only `**bold**` and newlines, and must not change — its canned strings contain
 * literal bullet characters that a fuller parser would reformat.
 */
import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

// ── inline ─────────────────────────────────────────────────────────────

/** `**bold**`, `*italic*`, `` `code` `` and `[text](href)`, in one pass so they can sit beside
 *  each other. Order in the alternation matters: bold before italic, or `**x**` is read as an
 *  italic containing an asterisk. */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="rounded bg-[#F1F5F9] px-1 py-0.5 font-mono text-[12px] text-[#364658]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = link[2];
      /* Only http(s) and mailto. A `javascript:` href in model output is exactly the injection
         this renderer exists to make impossible, and React will happily set it. */
      const safe = /^(https?:|mailto:)/i.test(href);
      return safe
        ? (
          <a
            key={key} href={href} target="_blank" rel="noopener noreferrer"
            className="text-[#3D8BD0] underline underline-offset-2 hover:text-[#2F7AB8]"
          >{link[1]}</a>
        )
        /* Not a scheme we allow — show the text, drop the link. Silently rendering nothing would
           hide that the model tried. */
        : <span key={key}>{link[1]}</span>;
    }
    return part;
  });
}

// ── code block ─────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative my-2">
      <pre className="overflow-x-auto rounded border border-[#E5E7EB] bg-[#F9FAFB] p-3">
        <code className="font-mono text-[12px] leading-relaxed text-[#364658]">{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code).then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
            () => { /* clipboard can be denied; the button simply does not confirm */ },
          );
        }}
        title="Copy code"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded border border-[#DFE5ED] bg-white text-[#6B7280] opacity-0 transition-opacity hover:bg-[#F3F4F6] focus-visible:opacity-100 group-hover:opacity-100"
      >
        {copied ? <Check size={13} className="text-[#22A06B]" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

// ── blocks ─────────────────────────────────────────────────────────────

const H = ['text-[15px]', 'text-[14px]', 'text-[13px]'];

/** A GFM table needs a header row, a delimiter row of dashes, and at least one body row. */
const isDelimiter = (l: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-');
const cells = (l: string) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

export function AiRichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    /* fenced code */
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++; }
      i++; // closing fence
      out.push(<CodeBlock key={`c${i}`} code={body.join('\n')} />);
      continue;
    }

    /* table */
    if (line.includes('|') && i + 1 < lines.length && isDelimiter(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(cells(lines[i])); i++; }
      out.push(
        /* Wide tables scroll inside their own box. The panel is 420px by default and a five-column
           table will not fit; the alternative is the whole thread scrolling sideways. */
        <div key={`t${i}`} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>{head.map((h, x) => (
                <th key={x} className="border-b border-[#E5E7EB] px-2 py-1.5 text-left font-semibold text-[#364658] whitespace-nowrap">
                  {inline(h, `th${x}`)}
                </th>
              ))}</tr>
            </thead>
            <tbody>{rows.map((r, y) => (
              <tr key={y}>{r.map((c, x) => (
                <td key={x} className="border-b border-[#F0F2F5] px-2 py-1.5 align-top text-[#364658]">
                  {inline(c, `td${y}-${x}`)}
                </td>
              ))}</tr>
            ))}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    /* heading */
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(
        <div key={`h${i}`} className={`mt-3 mb-1 font-semibold text-[#364658] ${H[level - 1]}`}>
          {inline(h[2], `h${i}`)}
        </div>,
      );
      i++;
      continue;
    }

    /* blockquote — used by the mock to mark a caveat about where numbers came from */
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { body.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(
        <div key={`q${i}`} className="my-2 border-l-2 border-[#DFE5ED] pl-3 text-[12px] text-[#7B8FA5]">
          {inline(body.join(' '), `q${i}`)}
        </div>,
      );
      continue;
    }

    /* list — one level, ordered or not */
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      out.push(
        <Tag key={`l${i}`} className={`my-1.5 space-y-1 pl-5 text-[13px] text-[#364658] ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((it, x) => <li key={x} className="leading-relaxed">{inline(it, `li${i}-${x}`)}</li>)}
        </Tag>,
      );
      continue;
    }

    /* blank */
    if (!line.trim()) { i++; continue; }

    /* paragraph — consecutive non-blank lines join, as markdown does */
    const para: string[] = [];
    while (i < lines.length && lines[i].trim()
      && !/^\s*```/.test(lines[i]) && !/^(#{1,3})\s/.test(lines[i])
      && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !/^\s*>\s?/.test(lines[i])
      && !(lines[i].includes('|') && i + 1 < lines.length && isDelimiter(lines[i + 1]))) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      out.push(
        <p key={`p${i}`} className="my-1.5 text-[13px] leading-relaxed text-[#364658]">
          {inline(para.join(' '), `p${i}`)}
        </p>,
      );
    }
  }

  return <div className="min-w-0">{out}</div>;
}
