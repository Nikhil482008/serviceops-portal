import { ShieldCheck, RefreshCw, MinusCircle, KeyRound } from 'lucide-react';
import type { Endpoint } from './EndpointsListPage';
import { bomCiId } from './bomData';
import type { BomRecord, BomStatus } from './bomData';

/* BOM Inventory grid — one row per CI, showing what its Bill of Materials contains.
 * Columns are BOM-specific (status / products / components / findings / crypto), unlike the
 * Endpoints listing which is about the agent itself. */

const Dash = () => <span className="text-[12px] text-[#9ca3af]">—</span>;

const STATUS_STYLE: Record<BomStatus, { bg: string; text: string; icon: typeof ShieldCheck }> = {
  Generated: { bg: '#ECFDF3', text: '#22A06B', icon: ShieldCheck },
  'In Progress': { bg: '#FEF7E6', text: '#D97706', icon: RefreshCw },
  'Not Generated': { bg: '#F1F5F9', text: '#64748B', icon: MinusCircle },
};

function StatusPill({ status }: { status: BomStatus }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[12px] font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <Icon size={13} />
      {status}
    </span>
  );
}

interface BomInventoryTableProps {
  rows: { endpoint: Endpoint; bom: BomRecord }[];
  selected: Set<string>;
  allSelected: boolean;
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: string, checked: boolean) => void;
  /** CI → the asset that owns this BOM: Asset › Hardware Asset, landed on its BOM tab. */
  onCiClick?: (endpoint: Endpoint) => void;
  /** End Point → the endpoint's own detail page, landed on its BOM tab. */
  onEndpointClick?: (endpoint: Endpoint) => void;
}

export function BomInventoryTable({ rows, selected, allSelected, onSelectAll, onSelect, onCiClick, onEndpointClick }: BomInventoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1500px]">
        <thead className="border-b border-[#e5e7eb]">
          <tr className="bg-white">
            <th className="w-[40px] px-4 py-2.5 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer rounded border-[#d1d5db] text-[#3D8BD0] focus:ring-[#3D8BD0] focus:ring-offset-0"
              />
            </th>
            {[
              ['CI', ''], ['End Point', 'min-w-[120px]'], ['Host Name', 'min-w-[170px]'], ['IP Address', 'min-w-[130px]'], ['OS', 'min-w-[210px]'],
              ['BOM Status', 'min-w-[140px]'], ['Products', ''], ['Components', ''], ['Vulnerabilities', 'min-w-[130px]'],
              ['Crypto Assets', 'min-w-[120px]'], ['AI Models', ''], ['Last Generated', 'min-w-[140px]'],
            ].map(([h, cls]) => (
              <th key={h} className={`${cls} px-4 py-2.5 text-left text-[12px] font-semibold text-[#364658] tracking-wider`}>
                <span className="whitespace-nowrap">{h}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e5e7eb] bg-white">
          {rows.length === 0 ? (
            <tr><td colSpan={13} className="px-4 py-12 text-center text-[13px] text-[#9CA3AF]">No CIs match your search.</td></tr>
          ) : rows.map(({ endpoint: e, bom }) => (
            <tr key={e.id} className="group hover:bg-[#f9fafb] transition-colors">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={(ev) => onSelect(e.id, ev.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer rounded border-[#d1d5db] text-[#3D8BD0] focus:ring-[#3D8BD0] focus:ring-offset-0"
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                  {/* agent-health dot, same treatment as the Endpoints listing */}
                  <span className="size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: e.agentOnline ? '#22C55E' : '#EAB308' }} />
                  {/* The CI is the ASSET the components hang off, so this opens
                      Asset › Hardware Asset on its BOM tab. */}
                  <button
                    onClick={() => onCiClick?.(e)}
                    title="Open the hardware asset's BOM"
                    className="inline-block rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-semibold text-[#3D8BD0] transition-colors hover:bg-[#d0e8f9]"
                  >{bomCiId(e.id)}</button>
                </span>
              </td>
              {/* The endpoint is the machine the agent scanned — a different record from the
                  asset above it, so it gets its own column and its own destination. */}
              <td className="px-4 py-3 whitespace-nowrap">
                <button
                  onClick={() => onEndpointClick?.(e)}
                  title="Open the endpoint's BOM"
                  className="inline-block rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-semibold text-[#3D8BD0] transition-colors hover:bg-[#d0e8f9]"
                >{e.id}</button>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]">
                {/* explicit size — a <button> does not inherit the cell's font-size here */}
                <button onClick={() => onEndpointClick?.(e)} className="text-[12px] transition-colors hover:text-[#3D8BD0]">{e.hostName}</button>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]">{e.ipAddress}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]">
                <span className="block max-w-[230px] truncate" title={e.osName}>{e.osName}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap"><StatusPill status={bom.status} /></td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]">{bom.products.length || <Dash />}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]">{bom.components || <Dash />}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px]">
                {/* Findings are the reason to look at a BOM at all — coloured when non-zero. */}
                <span className={bom.findings > 0 ? 'font-semibold text-[#D97706]' : 'text-[#9ca3af]'}>{bom.findings}</span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px]">
                {bom.cryptoAssets ? (
                  <span className="inline-flex items-center gap-1.5 text-[#364658]">
                    <KeyRound size={13} className="text-[#7B8FA5]" />{bom.cryptoAssets}
                  </span>
                ) : <Dash />}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]">{bom.aiModels || <Dash />}</td>
              <td className="px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]">{bom.lastGenerated ?? <Dash />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
