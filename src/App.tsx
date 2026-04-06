import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { StudyProvider } from '@/contexts/StudyContext'

import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { Home } from '@/pages/Home'
import { DisciplineDetail } from '@/pages/DisciplineDetail'
import { StudyMode } from '@/pages/StudyMode'
import { StudyComplete } from '@/pages/StudyComplete'
import { Favorites } from '@/pages/Favorites'
import { Errors } from '@/pages/Errors'
import { Stats } from '@/pages/Stats'
import { Admin } from '@/pages/Admin'
import { Import } from '@/pages/Import'
import { NotFound } from '@/pages/NotFound'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/disciplines" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/discipline/:disciplineId" element={<ProtectedRoute><DisciplineDetail /></ProtectedRoute>} />
      <Route path="/study/:subjectId" element={<ProtectedRoute><StudyMode /></ProtectedRoute>} />
      <Route path="/study/:subjectId/complete" element={<ProtectedRoute><StudyComplete /></ProtectedRoute>} />
      <Route path="/study-discipline/:disciplineId" element={<ProtectedRoute><StudyMode /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
      <Route path="/errors" element={<ProtectedRoute><Errors /></ProtectedRoute>} />
      <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />

      {/* Import — any authenticated user */}
      <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudyProvider>
          <AppRoutes />
          <Toaster richColors position="top-center" />
        </StudyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
