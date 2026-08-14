import {
  IconDashboard,
  IconRequest,
  IconProblem,
  IconChange,
  IconRelease,
  IconAssets,
  IconCMDB,
  IconVulnerability,
  IconPatch,
  IconPackage,
  IconProject,
  IconKnowledge,
  IconReport,
  IconMyApproval,
  IconTask,
  IconMyTeam,
  IconBom,
} from './SidebarIcons';
import { Cpu, AppWindow, Boxes, Recycle, KeyRound, Gauge, FileText, ShoppingCart, Rocket, Monitor, ClipboardCheck, Settings } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

// Asset sub-modules surfaced in the hover flyout (grouped with dividers).
const ASSET_GROUPS: { icon: React.ReactNode; label: string }[][] = [
  [
    { icon: <Cpu size={16} />, label: 'Hardware Assets' },
    { icon: <AppWindow size={16} />, label: 'Software Assets' },
    { icon: <Boxes size={16} />, label: 'Non-IT Assets' },
    { icon: <Recycle size={16} />, label: 'Consumable Assets' },
  ],
  [
    { icon: <KeyRound size={16} />, label: 'Software Licenses' },
    { icon: <Gauge size={16} />, label: 'Software Meter' },
  ],
  [
    { icon: <FileText size={16} />, label: 'Contracts' },
    { icon: <ShoppingCart size={16} />, label: 'Purchases' },
  ],
];

/** Assets nav item with a hover flyout listing the asset sub-modules. */
function AssetsNavItem({ activePage, onNavigate }: { activePage?: string; onNavigate?: (page: string) => void }) {
  // Map flyout labels to a navigable page.
  const pageFor = (label: string): string | undefined =>
    label === 'Hardware Assets' ? 'hardware-assets'
      : label === 'Software Assets' ? 'software-assets'
      : label === 'Non-IT Assets' ? 'non-it-assets'
      : label === 'Consumable Assets' ? 'consumable-assets'
      : label === 'Software Licenses' ? 'software-licenses'
      : label === 'Contracts' ? 'contracts'
      : label === 'Purchases' ? 'purchases'
      : undefined;
  const sectionActive = activePage === 'hardware-assets' || activePage === 'software-assets' || activePage === 'non-it-assets' || activePage === 'consumable-assets' || activePage === 'software-licenses' || activePage === 'contracts' || activePage === 'purchases';
  return (
    <div className="relative group">
      <NavItem icon={<IconAssets size={20} />} active={sectionActive} title="Assets" disableTooltip />
      {/* Flyout — pl-2 keeps a visual gap while bridging the hover area */}
      <div className="absolute left-full top-0 z-[9999] hidden group-hover:block pl-2">
        <div className="w-[210px] bg-white rounded-lg shadow-lg border border-[#DFE5ED] py-1">
          {ASSET_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="my-1 border-t border-[#F0F2F5]" />}
              {group.map((item) => {
                const page = pageFor(item.label);
                const isActive = !!page && page === activePage;
                return (
                  <button
                    key={item.label}
                    onClick={() => page && onNavigate?.(page)}
                    className={`w-full px-3 py-2 text-[13px] text-left transition-colors flex items-center gap-2.5 ${
                      isActive ? 'bg-[#3D8BD0] text-white' : 'hover:bg-[#F5F7FA] text-[#364658]'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Vulnerability sub-modules surfaced in the hover flyout. All three navigate; Endpoint reuses the
// Patch module's Endpoints listing + detail page (same 'endpoints' route).
const VULNERABILITY_ITEMS: { icon: React.ReactNode; label: string; page?: string }[] = [
  { icon: <IconPatch size={16} />, label: 'Vulnerabilities', page: 'vulnerabilities' },
  { icon: <IconVulnerability size={16} />, label: 'Detected CVEs', page: 'detected-cves' },
  { icon: <Monitor size={16} />, label: 'Endpoint', page: 'endpoints' },
];

/** Vulnerability nav item with a hover flyout listing its sub-modules (mirrors PatchNavItem). */
function VulnerabilityNavItem({ activePage, onNavigate }: { activePage?: string; onNavigate?: (page: string) => void }) {
  const sectionActive = activePage === 'vulnerabilities' || activePage === 'detected-cves';
  return (
    <div className="relative group">
      <NavItem icon={<IconVulnerability size={20} />} active={sectionActive} title="Vulnerability" disableTooltip />
      {/* Flyout — pl-2 keeps a visual gap while bridging the hover area */}
      <div className="absolute left-full top-0 z-[9999] hidden group-hover:block pl-2">
        <div className="w-[210px] bg-white rounded-lg shadow-lg border border-[#DFE5ED] py-1">
          {VULNERABILITY_ITEMS.map((item) => {
            const isActive = !!item.page && item.page === activePage;
            return (
              <button
                key={item.label}
                onClick={() => item.page && onNavigate?.(item.page)}
                className={`w-full px-3 py-2 text-[13px] text-left transition-colors flex items-center gap-2.5 whitespace-nowrap ${
                  isActive ? 'bg-[#3D8BD0] text-white' : 'hover:bg-[#F5F7FA] text-[#364658]'
                }`}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Patch sub-modules surfaced in the hover flyout. Patches + Patch Deployment navigate; the
// rest are prototype placeholders (no navigation yet).
const PATCH_ITEMS: { icon: React.ReactNode; label: string; page?: string }[] = [
  { icon: <IconPatch size={16} />, label: 'Patches', page: 'patches' },
  { icon: <Rocket size={16} />, label: 'Patch Deployment', page: 'patch-deployments' },
  { icon: <Monitor size={16} />, label: 'Endpoint', page: 'endpoints' },
  { icon: <ClipboardCheck size={16} />, label: 'Automatic Patch Test' },
  { icon: <Settings size={16} />, label: 'Automatic Patch Deployment' },
];

/** Patch nav item with a hover flyout listing the patch sub-modules (mirrors AssetsNavItem). */
function PatchNavItem({ activePage, onNavigate }: { activePage?: string; onNavigate?: (page: string) => void }) {
  const sectionActive = activePage === 'patches' || activePage === 'patch-deployments' || activePage === 'endpoints';
  return (
    <div className="relative group">
      <NavItem icon={<IconPatch size={20} />} active={sectionActive} title="Patch" disableTooltip />
      {/* Flyout — pl-2 keeps a visual gap while bridging the hover area */}
      <div className="absolute left-full top-0 z-[9999] hidden group-hover:block pl-2">
        <div className="w-[250px] bg-white rounded-lg shadow-lg border border-[#DFE5ED] py-1">
          {PATCH_ITEMS.map((item) => {
            const isActive = !!item.page && item.page === activePage;
            return (
              <button
                key={item.label}
                onClick={() => item.page && onNavigate?.(item.page)}
                className={`w-full px-3 py-2 text-[13px] text-left transition-colors flex items-center gap-2.5 whitespace-nowrap ${
                  isActive ? 'bg-[#3D8BD0] text-white' : 'hover:bg-[#F5F7FA] text-[#364658]'
                }`}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// BOM sub-modules surfaced in the hover flyout. BOM Inventory is one row per CI, Software
// Components is one row per component version across the fleet — the same data seen the other
// way up. Compliance Reports is the same inventory read against 13 regulatory frameworks, and
// Compliance Reports 2 is that same assessment in a split layout — a vertical framework rail
// instead of a horizontal carousel — carried as a second entry so the two are comparable
// side by side rather than one replacing the other unseen.
const BOM_ITEMS: { icon: React.ReactNode; label: string; page?: string }[] = [
  { icon: <IconBom size={16} />, label: 'BOM Inventory', page: 'bom' },
  { icon: <Boxes size={16} />, label: 'Software Components', page: 'software-components' },
  { icon: <ClipboardCheck size={16} />, label: 'Compliance Reports', page: 'compliance-reports' },
  { icon: <ClipboardCheck size={16} />, label: 'Compliance Reports 2', page: 'compliance-reports-2' },
];

/** BOM nav item with a hover flyout listing its sub-modules (mirrors VulnerabilityNavItem).
 *  Deliberately identical to its siblings — no title, no badge, no divider: a rail where one
 *  flyout is dressed differently reads as a different KIND of menu. */
function BomNavItem({ activePage, onNavigate }: { activePage?: string; onNavigate?: (page: string) => void }) {
  const sectionActive = activePage === 'bom' || activePage === 'software-components'
    || activePage === 'compliance-reports' || activePage === 'compliance-reports-2';
  return (
    <div className="relative group">
      <NavItem icon={<IconBom size={20} />} active={sectionActive} title="BOM" disableTooltip />
      {/* Flyout — pl-2 keeps a visual gap while bridging the hover area */}
      <div className="absolute left-full top-0 z-[9999] hidden group-hover:block pl-2">
        <div className="w-[210px] bg-white rounded-lg shadow-lg border border-[#DFE5ED] py-1">
          {BOM_ITEMS.map((item) => {
            const isActive = !!item.page && item.page === activePage;
            return (
              <button
                key={item.label}
                onClick={() => item.page && onNavigate?.(item.page)}
                className={`w-full px-3 py-2 text-[13px] text-left transition-colors flex items-center gap-2.5 whitespace-nowrap ${
                  isActive ? 'bg-[#3D8BD0] text-white' : 'hover:bg-[#F5F7FA] text-[#364658]'
                }`}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[#6B7280]'}`}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  // The Assets item shows its own hover flyout, so it opts out of the tooltip.
  disableTooltip?: boolean;
}

function NavItem({ icon, active, onClick, title, disableTooltip }: NavItemProps) {
  const button = (
    <button
      onClick={onClick}
      className={`flex h-[40px] w-full items-center justify-center transition-colors relative ${
        active
          ? 'bg-[#3D8BD0]'
          : 'bg-transparent hover:bg-[#e9ebef]'
      }`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2d6ca0]" />}
      <div className={`flex items-center justify-center size-[20px] ${active ? 'text-white' : 'text-[#364658]'}`}>
        {icon}
      </div>
    </button>
  );

  if (!title || disableTooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{title}</TooltipContent>
    </Tooltip>
  );
}

interface SidebarProps {
  activePage?: string;
  onNavigate?: (page: string) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full w-[54px] flex-col border-r border-[#e5e7eb] bg-[#f9fafb]">
      <div className="flex flex-col">
        <NavItem icon={<IconDashboard size={20} />} title="Dashboard" />
        <NavItem
          icon={<IconRequest size={20} />}
          active={activePage === 'request'}
          title="Request"
          onClick={() => onNavigate?.('request')}
        />
        <NavItem
          icon={<IconProblem size={20} />}
          active={activePage === 'problem'}
          title="Problem"
          onClick={() => onNavigate?.('problem')}
        />
        <NavItem
          icon={<IconChange size={20} />}
          active={activePage === 'change'}
          title="Change"
          onClick={() => onNavigate?.('change')}
        />
        <NavItem
          icon={<IconRelease size={20} />}
          active={activePage === 'release'}
          title="Release"
          onClick={() => onNavigate?.('release')}
        />
        <AssetsNavItem activePage={activePage} onNavigate={onNavigate} />
        <NavItem
          icon={<IconCMDB size={20} />}
          active={activePage === 'cmdb'}
          title="CMDB"
          onClick={() => onNavigate?.('cmdb')}
        />
        <VulnerabilityNavItem activePage={activePage} onNavigate={onNavigate} />
        {/* BOM — sits directly under Vulnerability; its flyout opens the BOM Inventory listing
            of the fleet, plus the two sub-modules that do not have screens yet. */}
        <BomNavItem activePage={activePage} onNavigate={onNavigate} />
        <PatchNavItem activePage={activePage} onNavigate={onNavigate} />
        <NavItem icon={<IconPackage size={20} />} title="Package" />
        <NavItem icon={<IconProject size={20} />} title="Project" />
        <NavItem icon={<IconKnowledge size={20} />} title="Knowledge" />
        <NavItem icon={<IconReport size={20} />} title="Report" />
        <NavItem icon={<IconMyApproval size={20} />} title="My Approval" />
        <NavItem icon={<IconTask size={20} />} title="Task" />
        <NavItem icon={<IconMyTeam size={20} />} title="My Team" />
      </div>
    </aside>
  );
}
