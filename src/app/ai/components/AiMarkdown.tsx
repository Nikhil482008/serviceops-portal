/* Markdown for assistant text.
 *
 * `renderAiText` is lifted VERBATIM from TicketPropertiesPanel's local `renderMarkdown`
 * (was lines 1213-1232). It handles exactly two things — `**bold**` and line breaks — because
 * that is all the canned responses contain. It returns an array of nodes rather than a wrapping
 * element, which is what lets it sit inside the existing `<p>` unchanged.
 *
 * It is deliberately NOT extended here. The ticket panel's output must stay pixel-identical
 * through this refactor, and a renderer that suddenly understood `#` or `-` would reformat those
 * canned strings — several of which contain literal `•` bullets and would change shape.
 *
 * The docked panel renders real model output and needs headings, lists, tables and code blocks.
 * That is a different renderer with a different risk profile (untrusted input), and it lands with
 * the panel rather than being bolted onto this one.
 */
import type { ReactNode } from 'react';

export function renderAiText(text: string): ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const renderedLine = parts.map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (lineIndex < lines.length - 1) {
      return <span key={lineIndex}>{renderedLine}<br /></span>;
    }
    return <span key={lineIndex}>{renderedLine}</span>;
  });
}
