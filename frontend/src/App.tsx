
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './modules/dashboard/pages/Dashboard';
import { CaseDetail } from './modules/expedientes/pages/CaseDetail';
import { NewCasePage } from './modules/expedientes/pages/NewCasePage';
import { EditCasePage } from './modules/expedientes/pages/EditCasePage';
import { ExpedienteList } from './modules/expedientes/pages/ExpedienteList';
import { ClientsList } from './modules/clients/pages/ClientsList';
import { NewClientPage } from './modules/clients/pages/NewClientPage';
import { ClientDetail } from './modules/clients/pages/ClientDetail';
import { EditClientPage } from './modules/clients/pages/EditClientPage';
import { LoginPage } from './modules/auth/pages/LoginPage';
import { AgendaPage } from './modules/agenda/pages/AgendaPage';
import { VencimientosPage } from './modules/vencimientos/pages/VencimientosPage';
import { DocumentsListPage } from './modules/documents/pages/DocumentsListPage';
import { DocumentDetailPage } from './modules/documents/pages/DocumentDetailPage';
import { LegalDraftsListPage } from './modules/legal-drafts/pages/LegalDraftsListPage';
import { LegalDraftWorkspacePage } from './modules/legal-drafts/pages/LegalDraftWorkspacePage';
import { LegalTemplatesPage } from './modules/legal-drafts/pages/LegalTemplatesPage';
import { LegalDraftGeneratorPage } from './modules/legal-drafts/pages/LegalDraftGeneratorPage';
import { LegalAiAssistantPage } from './modules/ia-legal/pages/LegalAiAssistantPage';
import { LegalAiAnalysisPage } from './modules/ia-legal/pages/LegalAiAnalysisPage';
import { IaLegalPendingModulePage } from './modules/ia-legal/pages/IaLegalPendingModulePage';
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
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  if (!sessionChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--hsl-text-muted))' }}>
        Verificando sesión...
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

import { LegalPixel } from './core/analytics/LegalPixel';
import { apiClient } from './core/api/client';
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionChecked = useAuthStore((state) => state.sessionChecked);
  const setSession = useAuthStore((state) => state.setSession);
  const setSessionChecked = useAuthStore((state) => state.setSessionChecked);

  useEffect(() => {
    if (sessionChecked) return;
    // Si no existe cookie csrf_token del BFF, omitir sonda inicial para evitar 401 innecesario en /login
    if (typeof document !== 'undefined' && !document.cookie.includes('csrf_token=')) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    apiClient.auth
      .getSession()
      .then((res) => {
        if (cancelled) return;
        if (res && res.status === 'authenticated' && res.user) {
          setSession(
            {
              id: res.user.id,
              email: res.user.email,
              name: res.user.fullName,
              role: res.user.orgRole || 'LAWYER',
            },
            res.organization ?? null,
          );
        } else {
          setSessionChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionChecked, setSession, setSessionChecked]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Track Page View (LegalPixel omite silenciosamente si no existe sesión BFF activa)
    LegalPixel.track('VIEW_PAGE', { path: location.pathname });
  }, [location.pathname, isAuthenticated]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/*" element={
        <ProtectedRoute>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<ClientsList />} />
              <Route path="/clientes/new" element={<NewClientPage />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/clientes/:id/edit" element={<EditClientPage />} />
              <Route path="/expedientes" element={<ExpedienteList />} />
              <Route path="/expedientes/new" element={<NewCasePage />} />
              <Route path="/expedientes/:id" element={<CaseDetail />} />
              <Route path="/expedientes/:id/edit" element={<EditCasePage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/vencimientos" element={<VencimientosPage />} />
              <Route path="/documentos" element={<DocumentsListPage />} />
              <Route path="/documentos/:id" element={<DocumentDetailPage />} />
              <Route path="/escritos" element={<LegalDraftsListPage />} />
              <Route path="/escritos/:id" element={<LegalDraftWorkspacePage />} />
              <Route path="/plantillas" element={<LegalTemplatesPage />} />
              <Route path="/ia-legal/generador-escritos" element={<LegalDraftGeneratorPage />} />
              <Route path="/ia-legal/asistente" element={<LegalAiAssistantPage />} />
              <Route path="/ia-legal/analisis" element={<LegalAiAnalysisPage />} />
              <Route
                path="/ia-legal/jurisprudencia"
                element={
                  <IaLegalPendingModulePage
                    title="Jurisprudencia IA"
                    subtitle="Módulo dedicado de búsqueda e investigación jurisprudencial con fuentes verificables."
                    plannedCapabilities={[
                      'Búsqueda de jurisprudencia nacional y provincial verificada.',
                      'Identificación de precedentes y análisis de pertinencia.',
                      'Citas y enlaces trazables a fuentes oficiales confirmadas.',
                      'Distinción explícita entre precedentes verificados y pendientes.',
                    ]}
                    disclaimer="Módulo pendiente de implementación. Nunca se muestran fallos ni citas jurisprudenciales inventadas."
                  />
                }
              />
              <Route
                path="/ia-legal/asistentes-externos"
                element={
                  <IaLegalPendingModulePage
                    title="Asistentes externos"
                    subtitle="Espacio reservado para futuras integraciones autorizadas con asistentes o proveedores externos."
                    plannedCapabilities={[
                      'Conectores auditados bajo autorización expresa de la organización.',
                      'Políticas explícitas de privacidad y minimización de datos.',
                      'Control granular de permisos y trazabilidad por usuario.',
                    ]}
                    disclaimer="No existen integraciones externas activas ni enlaces externos ficticios en esta fase."
                  />
                }
              />
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
