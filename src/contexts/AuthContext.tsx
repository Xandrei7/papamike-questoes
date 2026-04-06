import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type User, type Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { checkAdminRole } from '@/lib/dataService'
import type { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  isValidated: boolean
  loading: boolean
  authLoading: boolean
  profileLoading: boolean
  authorizationResolved: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)

  async function loadProfile(currentUser: User) {
    setProfileLoading(true)
    try {
      const userId = currentUser.id
      const normalizedEmail = currentUser.email?.trim().toLowerCase() || ''
      
      // HARDCODED ADMIN CHECK (Bulletproof source of truth)
      const isHardcodedAdmin = normalizedEmail === 'alexandregoncalvespmrr@gmail.com'

      let { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single()

      // Auto-create profile fallback if trigger failed
      if (!data) {
        const defaultStatus = isHardcodedAdmin ? 'approved' : 'pending'
        const defaultRole = isHardcodedAdmin ? 'admin' : 'user'
        try {
          const { forceCreateProfileFallback } = await import('@/lib/dataService')
          await forceCreateProfileFallback({ id: currentUser.id, email: normalizedEmail, name: currentUser.user_metadata?.name }, defaultStatus, defaultRole)
          const { data: newData } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
          data = newData
        } catch (e) {
          console.error('Migration pendente ou erro ao criar default profile:', e)
          data = { 
            user_id: userId, 
            email: normalizedEmail, 
            name: currentUser.user_metadata?.name || normalizedEmail.split('@')[0], 
            is_validated: isHardcodedAdmin, 
            status: defaultStatus, 
            role: defaultRole,
            created_at: new Date().toISOString()
          }
        }
      }

      if (data) {
        // Correção Problema 4: Suspended users can't bypass flow. Reset to pending on new login!
        if (data.status === 'suspended' || data.status === 'revoked') {
           try {
             const { updateUserStatus } = await import('@/lib/dataService')
             await updateUserStatus(userId, 'pending')
             data.status = 'pending'
             data.is_validated = false
           } catch(e) {
             console.error('Falha na atualização de suspenso para pendente. Rode a migration!', e)
           }
        }
        setProfile(data as Profile)
      }

      // Verificação Unificada de Admin
      let adminRole = isHardcodedAdmin || data?.role === 'admin'
      
      // Retrocompatibilidade (caso role esteja vazio, consulta tabela user_roles)
      if (!adminRole) {
        adminRole = await checkAdminRole(userId)
        // Auto-promoção do primeiro admin se não houver admins no BD
        if (!adminRole) {
          const { count } = await supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'admin')
          if (count === 0) {
            const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' })
            if (!error) adminRole = true
          }
        }
      }

      setIsAdmin(adminRole)

    } finally {
      // GARANTE QUE O LOADING DO PERFIL SOMENTE ENCERRARÁ QUANDO TUDO ISSO ACABAR
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
      
      if (session?.user) {
        // Se houver usuário, disparamos a busca do profile
        loadProfile(session.user)
      } else {
        // Se não houver, ambos loadings ficam prontos
        setProfileLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)

      if (session?.user) {
        loadProfile(session.user)
      } else {
        setProfile(null)
        setIsAdmin(false)
        setProfileLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw error
  }

  async function signUp(name: string, email: string, password: string) {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name } },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Lógica Final e Absoluta Unificada
  const loading = authLoading || profileLoading
  const authorizationResolved = !loading
  const isValidated = isAdmin || profile?.status === 'approved' || profile?.is_validated === true

  return (
    <AuthContext.Provider value={{ 
      user, session, profile, isAdmin, isValidated, 
      loading, authLoading, profileLoading, authorizationResolved, 
      signIn, signUp, signOut 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
