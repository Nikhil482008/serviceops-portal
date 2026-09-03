import { useState } from 'react';
import { AskAiProvider } from './ai/AskAiProvider';
import { NovaConversationProvider } from './ai/nova/NovaConversationProvider';
import { AskAiPanelMount } from './ai/AskAiPanelMount';
import { TicketListPage } from './components/TicketListPage';
import { ProblemListPage } from './components/ProblemListPage';
import { ChangeListPage } from './components/ChangeListPage';
import { ReleaseListPage } from './components/ReleaseListPage';
import { HardwareAssetsListPage } from './components/HardwareAssetsListPage';
import { SoftwareAssetsListPage } from './components/SoftwareAssetsListPage';
import { NonItAssetsListPage } from './components/NonItAssetsListPage';
import { ConsumableAssetsListPage } from './components/ConsumableAssetsListPage';
import { SoftwareLicensesListPage } from './components/SoftwareLicensesListPage';
import { ContractsListPage } from './components/ContractsListPage';
import { PurchasesListPage } from './components/PurchasesListPage';
import { CmdbListPage } from './components/CmdbListPage';
import { PatchesListPage } from './components/PatchesListPage';
import { PatchDeploymentsListPage } from './components/PatchDeploymentsListPage';
import { EndpointsListPage } from './components/EndpointsListPage';
import { VulnerabilitiesListPage } from './components/VulnerabilitiesListPage';
import { DetectedCvesListPage } from './components/DetectedCvesListPage';
import { AskAiUseCasesPage } from './components/AskAiUseCasesPage';
import { NovaDemoPage } from './components/NovaDemoPage';
import { Tec8Page } from './components/Tec8Page';
import { BomDashboardPage } from './components/BomDashboardPage';
import { BomDashboard2Page } from './components/BomDashboard2Page';
import { BomInventoryListPage } from './components/BomInventoryListPage';
import { SoftwareComponentsListPage } from './components/SoftwareComponentsListPage';
import { ComplianceReportsModule } from './components/ComplianceReportsModule';
import { ComplianceReports2Module } from './components/ComplianceReports2Module';
import { AdminPage } from './components/AdminPage';
import { DrawerStackProvider } from './components/DrawerStack';
import { GlobalSearch } from './components/GlobalSearch';
import { Toaster } from 'sonner';

type Page = 'request' | 'problem' | 'change' | 'release' | 'hardware-assets' | 'software-assets' | 'non-it-assets' | 'consumable-assets' | 'software-licenses' | 'contracts' | 'purchases' | 'cmdb' | 'patches' | 'patch-deployments' | 'endpoints' | 'vulnerabilities' | 'detected-cves' | 'bom-dashboard' | 'bom-dashboard-2' | 'bom' | 'software-components' | 'ai-components' | 'compliance-reports' | 'compliance-reports-2' | 'ask-ai-cases' | 'nova-demo' | 'tec8' | 'admin';

/* Pages that can be opened by link, opt-in one at a time.
 *
 * ⚠️ DELIBERATELY NOT THE WHOLE `Page` UNION. A query parameter that can open any screen is a
 * router, and this app already decided not to have one — `activePage` is a `useState` and the
 * rail sets it. This is the smallest thing that makes `?page=tec8&state=plan` a real link for
 * design review without a second navigation system growing around it. */
const LINKABLE: string[] = ['tec8', 'ask-ai-cases', 'nova-demo'];

export default function App() {
  const [activePage, setActivePage] = useState<Page>(() => {
    if (typeof window === 'undefined') return 'request';
    const p = new URLSearchParams(window.location.search).get('page');
    return p && LINKABLE.includes(p) ? (p as Page) : 'request';
  });
  /* A narrowing handed over WITH the navigation: the dashboard's "Review" lands on the register
     already showing only the vulnerable rows, rather than dumping the reader into everything and
     making them re-find what they clicked. Second argument, so the ~23 existing one-argument
     callers are untouched. Cleared as soon as the destination has taken it, or coming back to
     the page later by the rail would silently re-apply a filter nobody asked for. */
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const navigate = (page: string, focus?: string | null) => {
    setPendingFocus(focus ?? null);
    setActivePage(page as Page);
  };
  // A software asset id requested from elsewhere (e.g. the Software License "Managed Softwares" card),
  // consumed by the Software Assets list page to auto-open that asset's detail drawer.
  const [pendingSoftwareAssetId, setPendingSoftwareAssetId] = useState<string | null>(null);
  const openSoftwareAsset = (id: string) => { setPendingSoftwareAssetId(id); setActivePage('software-assets'); };

  return (
    /* Ask AI wraps the drawer host, not the other way round.
       Two consequences, both wanted: the rail button (rendered by Sidebar, inside every page)
       can reach it without prop-drilling through ~23 files, and a conversation outlives the
       detail drawer — which matters because DrawerStackProvider minimises on navigation, and
       the chat that shipped before this was destroyed when that happened. */
    <AskAiProvider>
    {/* The conversation lives ABOVE the drawer, not inside it: an investigation has to outlive
        the view showing it, or closing the drawer mid-turn would abort the work and a settled
        turn could not sit above a running one. Inside AskAiProvider because asking opens. */}
    <NovaConversationProvider>
    <DrawerStackProvider activePage={activePage}>
      {activePage === 'request' && <TicketListPage onNavigate={navigate} />}
      {activePage === 'problem' && <ProblemListPage onNavigate={navigate} />}
      {activePage === 'change' && <ChangeListPage onNavigate={navigate} />}
      {activePage === 'release' && <ReleaseListPage onNavigate={navigate} />}
      {activePage === 'hardware-assets' && <HardwareAssetsListPage onNavigate={navigate} />}
      {activePage === 'software-assets' && <SoftwareAssetsListPage onNavigate={navigate} initialOpenId={pendingSoftwareAssetId} onInitialOpenConsumed={() => setPendingSoftwareAssetId(null)} />}
      {activePage === 'non-it-assets' && <NonItAssetsListPage onNavigate={navigate} />}
      {activePage === 'consumable-assets' && <ConsumableAssetsListPage onNavigate={navigate} />}
      {activePage === 'software-licenses' && <SoftwareLicensesListPage onNavigate={navigate} onOpenSoftwareAsset={openSoftwareAsset} />}
      {activePage === 'contracts' && <ContractsListPage onNavigate={navigate} />}
      {activePage === 'purchases' && <PurchasesListPage onNavigate={navigate} />}
      {activePage === 'cmdb' && <CmdbListPage onNavigate={navigate} />}
      {activePage === 'patches' && <PatchesListPage onNavigate={navigate} />}
      {activePage === 'patch-deployments' && <PatchDeploymentsListPage onNavigate={navigate} />}
      {activePage === 'endpoints' && <EndpointsListPage onNavigate={navigate} />}
      {activePage === 'vulnerabilities' && <VulnerabilitiesListPage onNavigate={navigate} />}
      {activePage === 'detected-cves' && <DetectedCvesListPage onNavigate={navigate} />}
      {activePage === 'bom-dashboard' && <BomDashboardPage onNavigate={navigate} />}
      {activePage === 'bom-dashboard-2' && <BomDashboard2Page onNavigate={navigate} />}
      {activePage === 'bom' && <BomInventoryListPage onNavigate={navigate} initialFocus={pendingFocus} onInitialFocusConsumed={() => setPendingFocus(null)} />}
      {/* One page, two halves — which half is the ROUTE now, not a tab inside it, so the rail can
          land on either and a link can name one. */}
      {activePage === 'software-components' && <SoftwareComponentsListPage onNavigate={navigate} tab="components" initialFocus={pendingFocus} onInitialFocusConsumed={() => setPendingFocus(null)} />}
      {activePage === 'ai-components' && <SoftwareComponentsListPage onNavigate={navigate} tab="models" initialFocus={pendingFocus} onInitialFocusConsumed={() => setPendingFocus(null)} />}
      {activePage === 'compliance-reports' && <ComplianceReportsModule onNavigate={navigate} />}
      {activePage === 'compliance-reports-2' && <ComplianceReports2Module onNavigate={navigate} />}
      {activePage === 'ask-ai-cases' && <AskAiUseCasesPage onNavigate={navigate} />}
      {activePage === 'nova-demo' && <NovaDemoPage onNavigate={navigate} />}
      {activePage === 'tec8' && <Tec8Page onNavigate={navigate} />}
      {activePage === 'admin' && <AdminPage onNavigate={navigate} />}
      {/* Mounted once, inside the drawer host, so search works on every page and can open any
          module's real detail drawer as a tab. */}
      <GlobalSearch activePage={activePage} onNavigate={navigate} />
      {/* Lazy: the panel's chunk is not requested until it is first opened. */}
      <AskAiPanelMount activePage={activePage} />
      <Toaster position="top-right" />
    </DrawerStackProvider>
    </NovaConversationProvider>
    </AskAiProvider>
  );
}
