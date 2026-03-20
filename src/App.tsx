import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { GestorGuard } from './components/layout/GestorGuard'
import { LoginPage } from './pages/auth/LoginPage'
import { TrainingListPage } from './pages/tripulante/TrainingListPage'
import { TrainingPage } from './pages/tripulante/TrainingPage'
import { TrainingsPage } from './pages/gestor/TrainingsPage'
import { TrainingDetailPage } from './pages/gestor/TrainingDetailPage'
import { CrewPage } from './pages/gestor/CrewPage'
import { GroupsPage } from './pages/gestor/GroupsPage'
import { AccessPage } from './pages/gestor/AccessPage'
import { EngagementPage } from './pages/gestor/EngagementPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
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
            <Route element={<AppLayout />}>
              <Route path="/treinamentos" element={<TrainingListPage />} />
              <Route path="/treinamentos/:id" element={<TrainingPage />} />
              <Route element={<GestorGuard />}>
                <Route path="/gestor/treinamentos" element={<TrainingsPage />} />
                <Route path="/gestor/treinamentos/:id" element={<TrainingDetailPage />} />
                <Route path="/gestor/tripulantes" element={<CrewPage />} />
                <Route path="/gestor/turmas" element={<GroupsPage />} />
                <Route path="/gestor/engajamento" element={<EngagementPage />} />
                <Route path="/gestor/liberacoes" element={<AccessPage />} />
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
