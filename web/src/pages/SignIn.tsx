import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export default function SignIn() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  /**
   * Where to go once they are in. `next` lets the booking funnel send someone
   * to sign in and get them back to the step they left. Only a path on this
   * site is honoured, so the parameter cannot bounce anyone elsewhere.
   */
  const next = params.get('next')
  const after = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (user) navigate(after, { replace: true }) }, [user, navigate, after])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError(error)
    else navigate(after, { replace: true })
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 md:px-8">
      <p className="mb-4 font-mono uppercase" style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua-deep)' }}>
        RainbowOne
      </p>
      <h1 className="font-display" style={{ fontSize: 'clamp(1.9rem, 5vw, 2.8rem)', lineHeight: 1.05 }}>
        Welcome back.
      </h1>

      <form onSubmit={submit} noValidate className="mt-8">
        <label className="mb-5 block">
          <span className="kx-label">Email</span>
          <input className="kx-input" type="email" value={email} autoComplete="email"
                 onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mb-6 block">
          <span className="kx-label">Password</span>
          <input className="kx-input" type="password" value={password} autoComplete="current-password"
                 onChange={(e) => setPassword(e.target.value)} />
        </label>

        {error && (
          <p role="alert" className="mb-5" style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12, fontSize: 'var(--text-small)' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !email || !password} className="kx-cta w-full justify-center"
                style={{ opacity: busy || !email || !password ? 0.6 : 1 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
        Not a member yet? <Link to="/join" className="underline">Join RainbowOne free</Link>
      </p>
    </div>
  )
}
