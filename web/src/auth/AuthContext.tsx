import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { hasCredentials, supabase } from '@/lib/supabase'

interface AuthCtx {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

/** Supabase's messages are accurate but terse; these say what to do next. */
function readable(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) {
    return 'That email and password do not match an account. Check both, or join RainbowOne if you have not yet.'
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'That email is already a RainbowOne member. Sign in instead.'
  }
  if (m.includes('password should be at least')) {
    return 'Passwords need at least six characters.'
  }
  if (m.includes('email not confirmed')) {
    return 'This account still needs its email confirmed. Turn off email confirmation in Supabase, or use a confirmed address.'
  }
  if (m.includes('signups not allowed') || m.includes('email logins are disabled')) {
    return 'Email sign-up is switched off for this project. Enable the Email provider in Supabase → Authentication → Providers.'
  }
  return message
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasCredentials) { setLoading(false); return }
    let live = true
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthCtx>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    async signUp(email, password, fullName) {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      return { error: error ? readable(error.message) : null }
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      return { error: error ? readable(error.message) : null }
    },
    async signOut() {
      await supabase.auth.signOut()
    },
  }), [session, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
