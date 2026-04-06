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
  const [loading, setLoading] = useState(true)

  async function loadProfile(currentUser: User) {
    const userId = currentUser.id
    const normalizedEmail = currentUser.email?.trim().toLowerCase() || ''
    
    // HARDCODED ADMIN CHECK (Bulletproof)
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
        console.error('Migration pendente ou erro:', e)
        // Mock fallback if DB structure is missing to unblock UI
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
      // Problema 4: Usuário suspenso tentando acessar volta para pendente
      if (data.status === 'suspended' || data.status === 'revoked') {
         try {
           const { updateUserStatus } = await import('@/lib/dataService')
           await updateUserStatus(userId, 'pending')
           data.status = 'pending'
           data.is_validated = false
         } catch(e) {
           console.error('Erro ao repassar suspenso para pendente. Execute a SQL de migration!', e)
         }
      }
      setProfile(data as Profile)
    }

    let admin = isHardcodedAdmin
    if (!admin) {
      admin = await checkAdminRole(userId)
      // Auto-admin: if no admins exist yet, promote this user automatically
      if (!admin) {
        const { count } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'admin')

        if (count === 0) {
          const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' })
          if (!error) admin = true
        }
      }
    }

    setIsAdmin(admin)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user)
      } else {
        setProfile(null)
        setIsAdmin(false)
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

  // Permite o acesso se o status for explicitamente 'approved', ou o admin hardcoded, ou a retrocompatibilidade is_validated
  const isValidated = isAdmin || profile?.status === 'approved' || profile?.is_validated === true

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isValidated, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
