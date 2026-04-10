import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function GestorGuard() {
  const { profile } = useAuth()

  if (profile?.role !== 'gestor') {
    return <Navigate to="/comunidade" replace />
  }

  return <Outlet />
}
