import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { GestorGuard } from './components/layout/GestorGuard'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/public/RegisterPage'
import { PublicPostPage } from './pages/public/PublicPostPage'
import { ViralSignupPage } from './pages/public/ViralSignupPage'
import { CreditsPage } from './pages/tripulante/CreditsPage'
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
import { CreditSettingsPage } from './pages/gestor/CreditSettingsPage'
import { ProfilePage } from './pages/tripulante/ProfilePage'
import { FeedPage } from './pages/tripulante/FeedPage'
import { FreeProgramPage } from './pages/public/FreeProgramPage'
import { FreeProgramsListPage } from './pages/tripulante/FreeProgramsListPage'
import { FreeProgramWatchPage } from './pages/tripulante/FreeProgramWatchPage'
import { FreeProgramsPage as GestorFreeProgramsPage } from './pages/gestor/FreeProgramsPage'
import { FreeProgramEditPage } from './pages/gestor/FreeProgramEditPage'
import { LessonPage } from './pages/tripulante/LessonPage'
import { PostDetailPage } from './pages/tripulante/PostDetailPage'

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
            <Route path="/cadastro" element={<ViralSignupPage />} />
            <Route path="/cadastro/:slug" element={<RegisterPage />} />
            <Route path="/p/:postId" element={<PublicPostPage />} />
            <Route path="/programas/:slug" element={<FreeProgramPage />} />
            <Route element={<AppLayout />}>
              <Route path="/treinamentos" element={<TrainingListPage />} />
              <Route path="/programas-gratuitos" element={<FreeProgramsListPage />} />
              <Route path="/programas-gratuitos/:slug" element={<FreeProgramWatchPage />} />
              <Route path="/treinamentos/:id" element={<TrainingPage />} />
              <Route path="/treinamentos/:id/aula/:lessonId" element={<LessonPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/perfil/:userId" element={<ProfilePage />} />
              <Route path="/post/:postId" element={<PostDetailPage />} />
              <Route path="/creditos" element={<CreditsPage />} />
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
                <Route path="/gestor/creditos" element={<CreditSettingsPage />} />
                <Route path="/gestor/programas" element={<GestorFreeProgramsPage />} />
                <Route path="/gestor/programas/:id" element={<FreeProgramEditPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/comunidade" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
