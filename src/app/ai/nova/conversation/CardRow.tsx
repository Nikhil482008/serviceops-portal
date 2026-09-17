import { type ReactNode } from 'react';
import { EditableValue, SET_EMPTY, type EditableKind } from './EditableValue';
import { type DiffRow } from '../scripts/registry';

/* EVERY ROW IN EVERY CARD, and there are only four kinds of it.
 *
 * Before this, eight files drew the same row by hand — `flex items-baseline gap-4 py-2`, a
 * `w-[104px]` label, a `min-w-0 flex-1` value, and `i > 0 ? 'border-t' : ''` — and they had
 * already drifted: one used `gap-4`, another stacked the label above the value, two spelled the
 * divider differently, and the arrow in a diff row was written twice with different colours.
 * Eight copies of a layout is eight places for it to be nearly right.
 *
 * ── THE FOUR KINDS, AND WHAT EACH ONE CLAIMS ─────────────────────────────────────────────────
 *   value      label · plain value                 A FACT. Not the reader's to change, and it
 *                                                  says so by having no affordance at all.
 *   editable   label · EditableValue               NOVA'S PROPOSAL for a field that had no
 *                                                  previous value worth showing.
 *   diff       label · now · EditableValue         A FACT, and the proposal that replaces it —
 *                                                  in TWO COLUMNS under a named header, not a
 *                                                  sentence joined by an arrow.
 *   note       EditableValue, full width           A PARAGRAPH. No label column — prose that
 *                                                  has to share a line with a label is not
 *                                                  prose, it is a field.
 *
 * ── WHY THE DIFF IS A TABLE AND NOT A SENTENCE ───────────────────────────────────────────────
 * "Medium → High" reads left to right as one phrase, so three of them stacked read as three
 * phrases rather than one comparison: the eye has to find each arrow to learn where the old
 * value stopped. Two columns put every before under every other before, name themselves once at
 * the top ("NOW" · "AFTER ESCALATION"), and let the reader scan one side at a time. It also
 * gives the card somewhere to say WHAT the after-column is after — which the arrow never could.
 *
 * ── WHY THE BEFORE IS NOT AN EditableValue ───────────────────────────────────────────────────
 * It is what is true now. Nothing a reader does on this card can change what was already the
 * case, so it carries no pencil, takes no hover, and stays out of the tab order — a keyboard
 * reader tabbing a diff card lands only on things they can actually decide.
 */

export type CardRowKind = 'value' | 'editable' | 'diff' | 'note';

/** THE TWO COLUMNS, NAMED ONCE, above the first diff row.
 *
 *  `after` is the whole phrase — "After escalation" — and it comes from the card, which knows
 *  what its primary button does. It is never read off a row's label or off the button's own
 *  text: a card deriving it from the label would print "AFTER PRIORITY", and one deriving it
 *  from the button would print "AFTER RAISE TO HIGH ANYWAY".
 *
 *  The term cell is deliberately empty — the label column has no header, because the labels are
 *  the rows' own names rather than a third column of data. */
export function DiffHeader({ after }: { after: string }) {
  return (
    <div className="nova-row nova-row-head" data-row-head>
      <dt className="nova-row-label" />
      <dd className="nova-row-head-cell">Now</dd>
      <dd className="nova-row-head-cell" data-after>{after}</dd>
    </div>
  );
}

/* AN EMPTY BEFORE IS A WORD, NEVER A DASH. A column of values reading "—" tells the reader
   nothing about whether the field was blank, unknown, or not applicable; under a header that
   says NOW, the honest answer is a sentence. The set editor already owns one — "No one" is what
   an empty checklist commits — so a people field borrows that exact word and everything else
   says "None". Scripts write the blank several ways ('—', 'no one', ''), and all of them mean
   the same thing here. */
const NO_VALUE = /^(—|–|-|none|no one|n\/a)?$/i;
export const nowText = (before: string | undefined, editor?: EditableKind): string => {
  const t = (before ?? '').trim();
  return NO_VALUE.test(t) ? (editor === 'multi' ? SET_EMPTY : 'None') : t;
};

export function CardRows({ children, className = '', after }: {
  children: ReactNode;
  className?: string;
  /** Set ONLY by a card that shows diff rows — it names the after-column and turns the rows
   *  beneath it into a table. A card with nothing to compare leaves it off and keeps the plain
   *  two-column row it always had. */
  after?: string;
}) {
  return (
    <dl className={`nova-rows ${className}`}>
      {after ? <DiffHeader after={after} /> : null}
      {children}
    </dl>
  );
}

export function CardRow({
  kind, label, value, before, editor = 'text', options, inferred, readOnly, strong,
  rows, draftedLabel, focusSignal, rowId, onCommit,
}: {
  kind: CardRowKind;
  /** A stable hook — `data-row` — for the rare row something else has to find by name rather
   *  than by reading its label. */
  rowId?: string;
  /** Every kind but `note` — prose owns its whole width. */
  label?: string;
  /** The `value` kind may hand in a node (a priority pill, a reference chip); every other kind
   *  is editing a string, because that is what an editor commits. */
  value?: ReactNode;
  /** `diff` only — what is true now. */
  before?: string;
  /** Which editor the value opens. `note` is always a textarea. */
  editor?: EditableKind;
  options?: readonly string[];
  inferred?: boolean;
  readOnly?: boolean;
  strong?: boolean;
  rows?: number;
  draftedLabel?: string;
  focusSignal?: number;
  onCommit?: (next: string) => void;
}) {
  /* A row that cannot commit cannot be edited, whatever kind it claims to be — this is what
     stops a card from rendering an affordance it has nothing to do with. */
  const inert = readOnly || !onCommit;

  const field = (
    <EditableValue
      label={label ?? 'Value'}
      value={String(value ?? '')}
      kind={kind === 'note' ? 'textarea' : editor}
      options={options}
      inferred={inferred}
      /* A diff's after-value says nothing at rest — the column it sits in is already headed
         "AFTER …", which declares it a proposal — but says "· edited" the moment a reader
         changes it. */
      markEdited={kind === 'diff'}
      readOnly={inert}
      strong={strong}
      rows={rows}
      draftedLabel={draftedLabel}
      focusSignal={focusSignal}
      onCommit={onCommit ?? (() => {})}
    />
  );

  if (kind === 'note') {
    return (
      <div className="nova-row nova-row-note" data-row-kind="note">
        <dd className="nova-row-val">{field}</dd>
      </div>
    );
  }

  return (
    <div className="nova-row" data-row-kind={kind} data-row={rowId}>
      <dt className="nova-row-label">{label}</dt>
      {/* HISTORY, not an option, and a COLUMN rather than a prefix. Inert by construction: a
          `dd` with text in it — no tabindex, no handler, nothing to hover. */}
      {kind === 'diff' && (
        <dd className="nova-row-now" data-row-before>{nowText(before, editor)}</dd>
      )}
      <dd className="nova-row-val" data-kind={kind}>
        {kind === 'value'
          ? <span className="nova-edit-ro" data-strong={strong ? 'true' : 'false'}>{value}</span>
          : field}
      </dd>
    </div>
  );
}

/** A script's `DiffRow`, placed on the right kind of row. One mapping, used by every card that
 *  shows a before and an after, so "which rows can be argued with" is answered in exactly one
 *  place — by the script, read here. */
export function DiffRowCells({ row, value, onCommit }: {
  row: DiffRow;
  /** The after-value AS IT STANDS — the reader's edit if they made one, else the proposal. */
  value: string;
  onCommit: (edit: (was: Record<string, string>) => Record<string, string>) => void;
}) {
  return (
    <CardRow
      kind="diff"
      label={row.label}
      before={row.from}
      value={value}
      editor={row.editor}
      options={row.options}
      /* A FACT is a CONSEQUENCE of the change, not an offer within it — an SLA clock pausing
         because the ticket went on hold. It keeps its place in the two columns, because that is
         where the reader is looking for what the row was and what it becomes; what it never
         gets is a pencil, so there is nothing to argue with about arithmetic. */
      onCommit={row.editor && !row.fact
        ? (next) => onCommit((was) => ({ ...was, [row.label]: next }))
        : undefined}
    />
  );
}
