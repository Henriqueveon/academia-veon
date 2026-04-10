import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { GestorGuard } from './components/layout/GestorGuard'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/public/RegisterPage'
import { TrainingListPage } from './pages/tripulante/TrainingListPage'
import { TrainingPage } from './pages/tripulante/TrainingPage'
import { TrainingsPage } from './pages/gestor/TrainingsPage'
import { TrainingDetailPage } from './pages/gestor/TrainingDetailPage'
import { CrewPage } from './pages/gestor/CrewPage'
import { GroupsPage } from './pages/gestor/GroupsPage'
import { AccessPage } from './pages/gestor/AccessPage'
import { EngagementPage } from './pages/gestor/EngagementPage'
import { RegistrationLinksPage } from './pages/gestor/RegistrationLinksPage'
import { DashboardPage } from './pages/gestor/DashboardPage'
import { ProfilePage } from './pages/tripulante/ProfilePage'
import { FeedPage } from './pages/tripulante/FeedPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,           // 5 min — não refaz query a cada navegação
      gcTime: 1000 * 60 * 30,              // 30 min em memória
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro/:slug" element={<RegisterPage />} />
            <Route element={<AppLayout />}>
              <Route path="/treinamentos" element={<TrainingListPage />} />
              <Route path="/treinamentos/:id" element={<TrainingPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/perfil/:userId" element={<ProfilePage />} />
              <Route path="/comunidade" element={<FeedPage />} />
              <Route element={<GestorGuard />}>
                <Route path="/gestor" element={<DashboardPage />} />
                <Route path="/gestor/treinamentos" element={<TrainingsPage />} />
                <Route path="/gestor/treinamentos/:id" element={<TrainingDetailPage />} />
                <Route path="/gestor/tripulantes" element={<CrewPage />} />
                <Route path="/gestor/turmas" element={<GroupsPage />} />
                <Route path="/gestor/engajamento" element={<EngagementPage />} />
                <Route path="/gestor/liberacoes" element={<AccessPage />} />
                <Route path="/gestor/links-cadastro" element={<RegistrationLinksPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/treinamentos" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
