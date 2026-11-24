
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './modules/dashboard/pages/Dashboard';
import { CaseDetail } from './modules/expedientes/pages/CaseDetail';
import { NewCasePage } from './modules/expedientes/pages/NewCasePage';
import { ExpedienteList } from './modules/expedientes/pages/ExpedienteList';
import { LoginPage } from './modules/auth/pages/LoginPage';
import { AgendaPage } from './modules/agenda/pages/AgendaPage';
import { useAuthStore } from './core/store/useAuthStore';

import { JurisprudencePage } from './modules/jurisprudencia/pages/JurisprudencePage';
import { JurisprudenceDetail } from './modules/jurisprudencia/pages/JurisprudenceDetail';
import JurisprudenceSearchPage from './pages/Jurisprudence';
import { GeneralChatPage } from './modules/ia/pages/GeneralChatPage';
import { TemplatesPage } from './modules/templates/pages/TemplatesPage';
import { JudicialPage } from './modules/judicial/pages/JudicialPage';
import { PortalAdminPage } from './modules/portal/pages/PortalAdminPage';
import { SmartDraftingPage } from './modules/drafting/pages/SmartDraftingPage';
import { AdminDashboard } from './modules/admin/pages/AdminDashboard';

// Guard Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

import { LegalPixel } from './core/analytics/LegalPixel';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

// Separated Content to use useLocation inside Router context
const AppContent = () => {
  const location = useLocation();

  useEffect(() => {
    // Track Page View
    LegalPixel.track('VIEW_PAGE', { path: location.pathname });
  }, [location]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/*" element={
        <ProtectedRoute>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/expedientes" element={<ExpedienteList />} />
              <Route path="/expedientes/new" element={<NewCasePage />} />
              <Route path="/expedientes/:id" element={<CaseDetail />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/jurisprudencia/buscar" element={<JurisprudenceSearchPage />} />
              <Route path="/jurisprudencia" element={<JurisprudencePage />} />
              <Route path="/jurisprudencia/:id" element={<JurisprudenceDetail />} />
              <Route path="/ia" element={<GeneralChatPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/judicial" element={<JudicialPage />} />
              <Route path="/portal-admin" element={<PortalAdminPage />} />
              <Route path="/drafting" element={<SmartDraftingPage />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </MainLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default App;
