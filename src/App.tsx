import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import KundenverwaltungPage from '@/pages/KundenverwaltungPage';
import MotivkatalogPage from '@/pages/MotivkatalogPage';
import AuftragsverwaltungPage from '@/pages/AuftragsverwaltungPage';
import ProduktionsplanungPage from '@/pages/ProduktionsplanungPage';
import RechnungsverwaltungPage from '@/pages/RechnungsverwaltungPage';
import PublicFormKundenverwaltung from '@/pages/public/PublicForm_Kundenverwaltung';
import PublicFormMotivkatalog from '@/pages/public/PublicForm_Motivkatalog';
import PublicFormAuftragsverwaltung from '@/pages/public/PublicForm_Auftragsverwaltung';
import PublicFormProduktionsplanung from '@/pages/public/PublicForm_Produktionsplanung';
import PublicFormRechnungsverwaltung from '@/pages/public/PublicForm_Rechnungsverwaltung';
// <public:imports>
// </public:imports>
// <custom:imports>
const AuftragserfassungPage = lazy(() => import('@/pages/intents/AuftragserfassungPage'));
const AuftragsabschlussPage = lazy(() => import('@/pages/intents/AuftragsabschlussPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a0c963019308b30eb172e5a" element={<PublicFormKundenverwaltung />} />
              <Route path="public/6a0c963b2b58ecdaddd9c45a" element={<PublicFormMotivkatalog />} />
              <Route path="public/6a0c963cb70cf78c53ae48f5" element={<PublicFormAuftragsverwaltung />} />
              <Route path="public/6a0c963da5117dc0bec710a2" element={<PublicFormProduktionsplanung />} />
              <Route path="public/6a0c963dfa85ba0c705b1848" element={<PublicFormRechnungsverwaltung />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="kundenverwaltung" element={<KundenverwaltungPage />} />
                <Route path="motivkatalog" element={<MotivkatalogPage />} />
                <Route path="auftragsverwaltung" element={<AuftragsverwaltungPage />} />
                <Route path="produktionsplanung" element={<ProduktionsplanungPage />} />
                <Route path="rechnungsverwaltung" element={<RechnungsverwaltungPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/auftragserfassung" element={<Suspense fallback={null}><AuftragserfassungPage /></Suspense>} />
                <Route path="intents/auftragsabschluss" element={<Suspense fallback={null}><AuftragsabschlussPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
