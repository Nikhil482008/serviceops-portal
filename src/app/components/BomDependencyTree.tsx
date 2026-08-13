import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronRight, Search, X, ShieldAlert, Boxes } from 'lucide-react';
import type { DepGraph, DepNode } from './bomData';

/* The dependency view.
 *
 * A flat component list says WHAT is installed. It cannot say why — and "why" decides the fix:
 * a vulnerable library you declared yourself is a version bump; the same library four levels
 * down is someone else's release you wait for or override. The tree exists to separate those
 * two cases, so everything here is bent toward that question rather than toward rendering a
 * graph faithfully.
 *
 * What makes a tree unreadable at 250+ nodes is not the node count. It is asking the eye to do
 * two jobs it is bad at: measuring whitespace to judge depth, and guessing which rows are
 * pressable. So depth is DRAWN — every child list carries a guide rail and an open branch tints
 * its own container — and clickability is drawn too: a row that opens has a fill and a border at
 * rest, a leaf has neither. Neither fact should require a hover to discover.
 *
 * Two more decisions carry the rest:
 *   · search AUTO-EXPANDS to its matches and prunes everything else — a match you cannot see is
 *     the same as no match, and in a 7-hop tree highlight-only search finds nothing;
 *   · shared components expand once and are referenced afterwards, so a diamond in the graph
 *     cannot multiply into a tree bigger than the estate.
 */

const INDENT = 18;        // px of indent per level
const RAIL = 8;           // where the guide rail sits inside its parent's row
const DIRECT_PAGE = 25;   // direct dependencies rendered before the "show more" tail
/* Rows materialised per pass. Expand-all on a big product is hundreds of edges; painting them in
   one frame is the jank this budget exists to prevent. The tail loads as it scrolls into view. */
const ROW_PAGE = 200;

interface Props {
  graph: DepGraph;
  /** Opens the component list filtered to one name — the tree hands off rather than duplicating. */
  onInspect?: (name: string) => void;
}

/** One node as it is actually shown: after the search, the filter and the render budget. */
interface VisNode {
  id: string;
  node: DepNode;
  depth: number;
  parentId: string | null;
  children: VisNode[];
  expandable: boolean;
  open: boolean;
  /** Direct children in the GRAPH — the "3 deps" pill. Not `children.length`, which is what
   *  survived the current filter. */
  deps: number;
  /** This node's own name/PURL matched the search — distinct from merely being on the path. */
  hit: boolean;
}

/** Nodes whose subtree (or self) satisfies a predicate. One pass, so the recursive test does not
 *  get re-run per node while the tree is being built. */
function collectSubtrees(tree: DepNode[], test: (n: DepNode) => boolean): Set<DepNode> {
  const out = new Set<DepNode>();
  const walk = (n: DepNode): boolean => {
    let any = test(n);
    n.children.forEach((c) => { if (walk(c)) any = true; });
    if (any) out.add(n);
    return any;
  };
  tree.forEach(walk);
  return out;
}

/** The matched run, marked in place. No background swatch — the row is small enough that weight
 *  and colour carry it, and a marker would fight the row's own hover state. */
function Mark({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-[#3D8BD0]">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

function Stat({ label, value, tip, muted }: { label: string; value: React.ReactNode; tip?: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`text-[15px] font-semibold leading-none tabular-nums ${muted ? 'text-[#7B8FA5]' : 'text-[#364658]'}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] leading-none text-[#7B8FA5]">
        {tip ? <span className="cursor-help border-b border-dotted border-[#B8C4D2]" title={tip}>{label}</span> : label}
      </div>
    </div>
  );
}

export function BomDependencyTree({ graph, onInspect }: Props) {
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [vulnOnly, setVulnOnly] = useState(false);
  /* Two ways to be open, because "expand all" cannot mean "write every id into a set" when the
     point is not to walk the whole graph: in default mode `expanded` holds what is open, in
     all-mode `collapsed` holds the exceptions. */
  const [allOpen, setAllOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [shownDirect, setShownDirect] = useState(DIRECT_PAGE);
  const [budget, setBudget] = useState(ROW_PAGE);
  const [focusId, setFocusId] = useState<string | null>(null);

  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ allOpen, expanded, collapsed });
  stateRef.current = { allOpen, expanded, collapsed };
  /** The expand state before a search started, so clearing the box puts the tree back. */
  const preSearch = useRef<typeof stateRef.current | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (q && !preSearch.current) preSearch.current = stateRef.current;
    else if (!q && preSearch.current) {
      const s = preSearch.current;
      preSearch.current = null;
      setAllOpen(s.allOpen); setExpanded(s.expanded); setCollapsed(s.collapsed);
    }
  }, [q]);

  useEffect(() => { setShownDirect(DIRECT_PAGE); setBudget(ROW_PAGE); }, [q, vulnOnly, graph]);

  const isOpen = (id: string) => (allOpen ? !collapsed.has(id) : expanded.has(id));

  /* ONE derivation of what is on screen, consumed twice: recursively for the render (nested
     containers are what draw the rails and the branch tint) and flattened for keyboard
     navigation. Deriving those separately is how the two drift apart. */
  const { roots, eligible, truncated } = useMemo(() => {
    const vulnSet = vulnOnly ? collectSubtrees(graph.tree, (n) => n.cves > 0) : null;
    const matchSet = q
      ? collectSubtrees(graph.tree, (n) => n.name.toLowerCase().includes(q) || n.purl.toLowerCase().includes(q))
      : null;
    const keeps = (n: DepNode) => (!vulnSet || vulnSet.has(n)) && (!matchSet || matchSet.has(n));
    const searching = !!q || vulnOnly;

    let used = 0;
    let cut = false;
    const build = (n: DepNode, path: string, depth: number, parentId: string | null): VisNode | null => {
      if (!keeps(n)) return null;
      // Budget is spent in screen order, so what gets dropped is always the tail.
      if (used >= budget) { cut = true; return null; }
      used++;
      const id = `${path}/${n.key}`;
      // Searching and filtering open the tree themselves — the point of both is to be seen.
      const open = searching || isOpen(id);
      const children = open
        ? n.children.map((c) => build(c, id, depth + 1, id)).filter((c): c is VisNode => c !== null)
        : [];
      return {
        id, node: n, depth, parentId, children,
        // A closed branch is never walked, so the count comes off the graph, not the render.
        expandable: searching ? children.length > 0 : n.children.length > 0,
        deps: n.children.length,
        open,
        hit: !!q && (n.name.toLowerCase().includes(q) || n.purl.toLowerCase().includes(q)),
      };
    };

    const eligibleRoots = graph.tree.filter(keeps);
    const built: VisNode[] = [];
    for (const n of eligibleRoots.slice(0, shownDirect)) {
      const v = build(n, 'root', 1, null);
      if (v) built.push(v);
    }
    return { roots: built, eligible: eligibleRoots.length, truncated: cut };
    // `isOpen` closes over allOpen/expanded/collapsed, which are all listed.
  }, [graph.tree, q, vulnOnly, expanded, collapsed, allOpen, shownDirect, budget]);

  const hiddenDirect = eligible - roots.length;

  /* Grow the budget as the tail comes into view. Falls back to a clickable row where there is no
     IntersectionObserver, so it is never a dead end. */
  useEffect(() => {
    if (!truncated || typeof IntersectionObserver === 'undefined') return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setBudget((b) => b + ROW_PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [truncated, budget]);

  /** Rows in screen order — the keyboard's model of the tree. */
  const flat = useMemo(() => {
    const out: VisNode[] = [];
    const walk = (v: VisNode) => { out.push(v); if (v.open) v.children.forEach(walk); };
    roots.forEach(walk);
    return out;
  }, [roots]);

  const matchCount = useMemo(() => {
    if (!q) return 0;
    let n = 0;
    const walk = (v: VisNode) => { if (v.hit) n++; v.children.forEach(walk); };
    roots.forEach(walk);
    return n;
  }, [roots, q]);

  const vulnerablePaths = useMemo(
    () => graph.tree.filter((n) => collectSubtrees([n], (x) => x.cves > 0).has(n)).length,
    [graph.tree],
  );

  const flip = (s: Set<string>, id: string) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; };
  const toggle = (id: string) => (allOpen ? setCollapsed((p) => flip(p, id)) : setExpanded((p) => flip(p, id)));
  const expandAll = () => { setAllOpen(true); setCollapsed(new Set()); setBudget(ROW_PAGE); };
  const collapseAll = () => { setAllOpen(false); setExpanded(new Set()); setCollapsed(new Set()); setBudget(ROW_PAGE); };

  const focusRow = (v?: VisNode) => {
    if (!v) return;
    setFocusId(v.id);
    rowRefs.current.get(v.id)?.focus();
  };

  /* WAI-ARIA tree keys. There is no tree primitive in this codebase and no tree library in the
     bundle, so this is the minimum that makes the control usable without a mouse. */
  const onKeyDown = (e: React.KeyboardEvent, v: VisNode) => {
    const i = flat.findIndex((f) => f.id === v.id);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusRow(flat[i + 1]); break;
      case 'ArrowUp': e.preventDefault(); focusRow(flat[i - 1]); break;
      case 'Home': e.preventDefault(); focusRow(flat[0]); break;
      case 'End': e.preventDefault(); focusRow(flat[flat.length - 1]); break;
      case 'ArrowRight':
        e.preventDefault();
        if (v.expandable && !v.open) toggle(v.id);
        else if (v.open) focusRow(flat[i + 1]);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (v.expandable && v.open) toggle(v.id);
        else focusRow(flat.find((f) => f.id === v.parentId));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        v.expandable ? toggle(v.id) : onInspect?.(v.node.name);
        break;
    }
  };

  const renderNode = (v: VisNode): React.ReactNode => {
    const n = v.node;
    const tabbable = focusId ? focusId === v.id : v.id === flat[0]?.id;
    /* The affordance. A row that opens carries a faint fill and a hairline at rest and holds the
       accent while it is open; a leaf carries neither and a regular-weight name. Both keep the
       same border box, so the two never differ in height. */
    const skin = !v.expandable
      ? 'border-transparent hover:bg-[#F4F7FA]'
      : v.open
        ? 'border-[#BBD7F0] bg-[#EAF2FB]'
        : 'border-[#E5E9EF] bg-[#364658]/[0.04] hover:border-[#BBD7F0] hover:bg-[#EAF2FB]';

    return (
      <div key={v.id}>
        <div
          ref={(el) => { el ? rowRefs.current.set(v.id, el) : rowRefs.current.delete(v.id); }}
          role="treeitem"
          aria-level={v.depth}
          aria-expanded={v.expandable ? v.open : undefined}
          aria-label={`${n.name} ${n.version}`}
          tabIndex={tabbable ? 0 : -1}
          onFocus={() => setFocusId(v.id)}
          onKeyDown={(e) => onKeyDown(e, v)}
          // The whole row toggles — a 12px chevron is a poor click target, and on a leaf the
          // row's only useful action is to go and look at the component.
          onClick={() => (v.expandable ? toggle(v.id) : onInspect?.(n.name))}
          className={`group mb-px flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-lg border-[0.5px] pr-2.5 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[#3D8BD0] ${skin}`}
          style={{ paddingLeft: v.depth === 1 ? 6 : INDENT - RAIL }}
        >
          {v.expandable ? (
            <ChevronRight
              size={12}
              className={`flex-shrink-0 transition-transform duration-150 ${v.open ? 'rotate-90 text-[#3D8BD0]' : 'text-[#7B8FA5]'}`}
            />
          ) : (
            // Same footprint as the chevron, so names line up whether or not a row opens.
            <span className="flex w-3 flex-shrink-0 justify-center text-[#CBD5E1]">&middot;</span>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onInspect?.(n.name); }}
            className={`min-w-0 truncate text-left font-mono text-[12.5px] leading-none text-[#364658] transition-colors hover:text-[#3D8BD0] ${v.expandable ? 'font-semibold' : ''}`}
            title={`${n.name}@${n.version} — open in the component list`}
          >
            <Mark text={n.name} q={q} />
          </button>
          <span className="flex-shrink-0 font-mono text-[11.5px] leading-none text-[#9CA3AF]">{n.version}</span>

          {n.cves > 0 && (
            <span
              className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-sm bg-[#FEF3F2] px-1.5 py-0.5 text-[10.5px] font-medium leading-none text-[#DC2626]"
              title={`${n.cves} known vulnerabilit${n.cves === 1 ? 'y' : 'ies'} in this build`}
            >
              <ShieldAlert size={10} />{n.cves}
            </span>
          )}

          {/* Beside the name it describes. A count parked at the drawer's far edge belongs to
              nothing — at 1,240px there is a hand-span of empty row between the two. */}
          {v.expandable && !v.open && (
            <span className="flex-shrink-0 rounded-sm bg-[#F1F5F9] px-1.5 py-0.5 text-[10.5px] leading-none tabular-nums text-[#64748B]">
              {v.deps} dep{v.deps === 1 ? '' : 's'}
            </span>
          )}

          {n.uses > 1 && (
            <span
              className="flex-shrink-0 cursor-help rounded-sm bg-[#F1F5F9] px-1.5 py-0.5 text-[10.5px] leading-none text-[#64748B]"
              title={`Appears under ${n.uses} parents in the tree.`}
            >&times;{n.uses}</span>
          )}

          {n.repeat && (
            <span className="flex-shrink-0 text-[10.5px] leading-none text-[#9CA3AF]" title="Expanded higher up in the tree">
              shown above
            </span>
          )}
        </div>

        {v.open && v.children.length > 0 && (
          /* The rail draws the depth and the tint groups the branch. Alpha is deliberately tiny
             (3.5%) because these containers nest — at depth 5 a solid step per level would be a
             dark stripe, while this compounds into something you can still read text on. */
          <div
            className="rounded-r-lg border-l-[0.5px] border-[#E9EEF4] bg-[#364658]/[0.035] py-px transition-colors"
            style={{ marginLeft: RAIL }}
          >
            {v.children.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The shape of the graph, before any of it is read. */}
      <div className="grid grid-cols-4 gap-x-6 border-b border-[#EEF2F6] px-5 py-3">
        <Stat label="Direct" value={graph.direct} />
        <Stat label="Transitive" value={graph.transitive} />
        <Stat label="Max depth" value={graph.maxDepth} />
        <Stat
          label="Not in graph"
          value={graph.notInGraph}
          muted
          tip={`Components with no dependency edges in the SBOM — vendored copies, OS packages, anything without a manifest. ${graph.notInGraph} of ${graph.total} components in this scope; they are installed, they just cannot be placed.`}
        />
      </div>

      <div className="flex items-center gap-2 px-5 py-2.5">
        <div className="relative min-w-[180px] max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
            placeholder="Find a package..."
            className="h-8 w-full rounded border border-[#d1d5db] bg-white pl-8 pr-8 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"
              aria-label="Clear search"
            ><X size={14} /></button>
          )}
        </div>

        {q && (
          <span className="flex-shrink-0 text-[12px] tabular-nums text-[#7B8FA5]">
            {matchCount} match{matchCount === 1 ? '' : 'es'}
          </span>
        )}

        {/* At this depth the only reason to walk the tree is to find what a vulnerable component
            is hanging off — so this filter is the shortcut past the whole exercise. */}
        <button
          onClick={() => setVulnOnly((v) => !v)}
          className={`inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
            vulnOnly
              ? 'border-[#FCA5A5] bg-[#FEF3F2] text-[#DC2626]'
              : 'border-[#DFE5ED] bg-white text-[#DC2626] hover:border-[#FCA5A5] hover:bg-[#FEF3F2]'
          }`}
          aria-pressed={vulnOnly}
        >
          <ShieldAlert size={14} />
          Vulnerable paths
          <span className="tabular-nums text-[#DC2626]/70">&middot; {vulnerablePaths}</span>
        </button>

        <div className="inline-flex h-8 flex-shrink-0 items-center overflow-hidden rounded border border-[#DFE5ED] bg-white">
          <button onClick={expandAll} className="h-full px-2.5 text-[13px] text-[#64748B] transition-colors hover:bg-[#F5F7FA] hover:text-[#364658]">
            Expand all
          </button>
          <span className="h-4 w-px flex-shrink-0 bg-[#E5E7EB]" />
          <button onClick={collapseAll} className="h-full px-2.5 text-[13px] text-[#64748B] transition-colors hover:bg-[#F5F7FA] hover:text-[#364658]">
            Collapse all
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 pb-3">
        {roots.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[14px] font-medium text-[#364658]">
              {q ? 'Nothing matches that search' : 'No vulnerable dependency paths'}
            </p>
            <p className="mt-1 text-[13px] text-[#7B8FA5]">
              {q ? 'Search runs over package names and PURLs.' : 'Every declared dependency and everything under it is clean.'}
            </p>
          </div>
        ) : (
          <>
            {/* Where you are. It stays put because at depth 6 the row above you is no longer the
                thing you are inside. */}
            <div className="sticky top-0 z-10 flex h-[30px] items-center gap-2 bg-white">
              <Boxes size={13} className="flex-shrink-0 text-[#7B8FA5]" />
              <span className="truncate font-mono text-[12.5px] font-semibold text-[#364658]">{graph.rootLabel}</span>
              <span className="flex-shrink-0 text-[11px] text-[#7B8FA5]">root &middot; {graph.direct} direct</span>
            </div>

            <div role="tree" aria-label="Dependency tree">
              {roots.map(renderNode)}
            </div>

            {truncated && (
              <div
                ref={sentinelRef}
                onClick={() => setBudget((b) => b + ROW_PAGE)}
                className="mt-1 flex h-8 cursor-pointer items-center rounded-lg px-2 text-[12px] text-[#7B8FA5] transition-colors hover:bg-[#F5F7FA]"
              >Loading deeper branches...</div>
            )}

            {hiddenDirect > 0 && (
              <button
                onClick={() => setShownDirect((n) => n + DIRECT_PAGE)}
                className="mt-1 h-8 rounded-lg px-2 text-[12px] text-[#3D8BD0] transition-colors hover:bg-[#F5FAFF]"
              >Show {Math.min(DIRECT_PAGE, hiddenDirect)} more direct dependencies...</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
