import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

export default function Join() {
  const { signUp, user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  useEffect(() => { if (user) navigate('/account', { replace: true }) }, [user, navigate])

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const passOk = password.length >= 6
  const nameOk = name.trim().length > 0
  const ok = emailOk && passOk && nameOk

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!ok) return
    setBusy(true)
    setError(null)
    const { error } = await signUp(email, password, name)
    setBusy(false)
    if (error) setError(error)
    else navigate('/account', { replace: true })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-5 py-14 md:grid-cols-2 md:px-8">
      <div>
        <p
          className="mb-4 font-mono uppercase"
          style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua-deep)' }}
        >
          RainbowOne
        </p>
        <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.05 }}>
          Join our RainbowOne family today.
        </h1>
        <p className="mt-4" style={{ color: 'var(--color-ink-mute)', maxWidth: '40ch' }}>
          Free to join, and you start earning on your very next Karination
          flight. We only need a name, an email and a password.
        </p>

        <ul className="mt-8">
          {[
            ['Jade', 'var(--color-spectrum-teal)', 'Yours the moment you join'],
            ['Amber', 'var(--color-spectrum-amber)', '25,000 miles · +25% bonus'],
            ['Amethyst', 'var(--color-spectrum-violet)', '60,000 miles · +50% bonus'],
            ['Ruby', 'var(--color-spectrum-magenta)', '120,000 miles · double miles'],
          ].map(([n, hue, note]) => (
            <li key={n} className="flex items-baseline gap-3 py-2.5" style={{ borderTop: 'var(--rule)' }}>
              <span aria-hidden style={{ width: 12, height: 12, background: hue, borderRadius: 3, flex: 'none' }} />
              <span style={{ fontWeight: 600 }}>{n}</span>
              <span className="ml-auto tnum" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                {note}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <form
        onSubmit={submit}
        noValidate
        style={{
          border: 'var(--rule)', borderTop: '3px solid var(--color-spectrum-teal)',
          borderRadius: 'var(--radius-soft)', padding: '26px', alignSelf: 'start',
        }}
      >
        <h2 className="mb-6" style={{ fontSize: 'var(--text-lead)', fontWeight: 600 }}>Create your account</h2>

        <label className="mb-5 block">
          <span className="kx-label">Full name</span>
          <input
            className="kx-input" value={name} autoComplete="name"
            onChange={(e) => setName(e.target.value)}
            aria-invalid={tried && !nameOk}
          />
          {tried && !nameOk && <Err>Tell us what to call you.</Err>}
        </label>

        <label className="mb-5 block">
          <span className="kx-label">Email</span>
          <input
            className="kx-input" type="email" value={email} autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={tried && !emailOk}
          />
          {tried && !emailOk
            ? <Err>Enter an email address like name@example.com.</Err>
            : <Hint>This is your membership. Book with it and your miles credit automatically.</Hint>}
        </label>

        <label className="mb-6 block">
          <span className="kx-label">Password</span>
          <input
            className="kx-input" type="password" value={password} autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={tried && !passOk}
          />
          {tried && !passOk ? <Err>At least six characters.</Err> : <Hint>At least six characters.</Hint>}
        </label>

        {error && (
          <p role="alert" className="mb-5" style={{ color: 'var(--color-danger)', borderLeft: '2px solid var(--color-danger)', paddingLeft: 12, fontSize: 'var(--text-small)' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="kx-cta w-full justify-center" style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Creating your account…' : 'Join RainbowOne'}
        </button>

        <p className="mt-5" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
          Already a member? <Link to="/signin" className="underline">Sign in</Link>
        </p>
      </form>
    </div>
  )
}

const Err = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-1 block" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-danger)' }}>{children}</span>
)
const Hint = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-1 block" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>{children}</span>
)
