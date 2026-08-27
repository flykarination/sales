import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackLink, FunnelPage } from '@/components/Funnel'
import { useBooking, type Passenger } from '@/booking/BookingContext'

const EMPTY_PAX: Passenger = { given_name: '', family_name: '', passenger_type: 'ADULT' }

const PAX_LABEL: Record<Passenger['passenger_type'], string> = {
  ADULT: 'Adult',
  CHILD: 'Child',
  INFANT: 'Infant',
}

export default function Passengers() {
  const { draft, set, legs } = useBooking()
  const navigate = useNavigate()
  // One row per traveller, already labelled with the type chosen in the
  // search. The type stays editable — someone whose child turns twelve
  // before departure needs to be able to fix it here rather than start over.
  const seeded = useMemo<Passenger[]>(() => {
    const rows: Passenger[] = []
    const add = (n: number, type: Passenger['passenger_type']) => {
      for (let i = 0; i < n; i += 1) rows.push({ ...EMPTY_PAX, passenger_type: type })
    }
    add(Math.max(draft.adults, 1), 'ADULT')
    add(Math.max(draft.children, 0), 'CHILD')
    add(Math.max(draft.infants, 0), 'INFANT')
    return rows
  }, [draft.adults, draft.children, draft.infants])

  const [pax, setPax] = useState<Passenger[]>(
    draft.passengers.length === seeded.length ? draft.passengers : seeded,
  )
  const [email, setEmail] = useState(draft.contactEmail)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (legs.length === 0) navigate('/', { replace: true })
  }, [legs.length, navigate])

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const paxErrors = pax.map((p) => ({
    given_name: p.given_name.trim() ? null : 'Enter the given name as it appears on their passport.',
    family_name: p.family_name.trim() ? null : 'Enter the family name as it appears on their passport.',
  }))
  const valid = emailValid && paxErrors.every((e) => !e.given_name && !e.family_name)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!valid) {
      document.querySelector<HTMLElement>('[data-invalid="true"]')?.focus()
      return
    }
    set({
      passengers: pax.map((p) => ({ ...p, given_name: p.given_name.trim(), family_name: p.family_name.trim() })),
      contactEmail: email.trim().toLowerCase(),
      contactName: `${pax[0].given_name} ${pax[0].family_name}`.trim(),
    })
    navigate('/payment')
  }

  function update(i: number, patch: Partial<Passenger>) {
    setPax((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }

  return (
    <FunnelPage title="Who is travelling?">
      <form onSubmit={submit} noValidate>
        <p className="mb-6" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)', maxWidth: '52ch' }}>
          Names must match the passport each passenger will travel on. We do not
          collect passport numbers.
        </p>

        {pax.map((p, i) => {
          const err = paxErrors[i]
          const show = tried || touched[`${i}`]
          return (
            <fieldset key={i} className="mb-8">
              <legend
                className="mb-4 font-mono uppercase"
                style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-ink-mute)' }}
              >
                Passenger {i + 1} · {PAX_LABEL[p.passenger_type]}
              </legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Given name" value={p.given_name} autoComplete="given-name"
                  error={show ? err.given_name : null}
                  onChange={(v) => update(i, { given_name: v })}
                  onBlur={() => setTouched((t) => ({ ...t, [`${i}`]: true }))}
                />
                <TextField
                  label="Family name" value={p.family_name} autoComplete="family-name"
                  error={show ? err.family_name : null}
                  onChange={(v) => update(i, { family_name: v })}
                  onBlur={() => setTouched((t) => ({ ...t, [`${i}`]: true }))}
                />
                <label className="block">
                  <span className="kx-label">Passenger type</span>
                  <select
                    value={p.passenger_type}
                    onChange={(e) => update(i, { passenger_type: e.target.value as Passenger['passenger_type'] })}
                    className="kx-input"
                  >
                    <option value="ADULT">Adult</option>
                    <option value="CHILD">Child (2–11)</option>
                    <option value="INFANT">Infant (under 2)</option>
                  </select>
                </label>
              </div>
            </fieldset>
          )
        })}

        <fieldset className="mb-8">
          <legend
            className="mb-4 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-ink-mute)' }}
          >
            Contact
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Email" value={email} type="email" autoComplete="email"
              hint="Your booking reference is sent here, and you will need it to manage the booking."
              error={(tried || touched.email) && !emailValid ? 'Enter an email address like name@example.com.' : null}
              onChange={setEmail}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-5">
          <button
            type="submit"
            className="font-mono uppercase"
            style={{
              background: 'var(--color-ink)', color: 'var(--color-paper)',
              padding: '14px 24px', minHeight: 52, letterSpacing: '0.16em',
              fontSize: 'var(--text-small)', borderRadius: 'var(--radius-edge)',
            }}
          >
            Continue to payment
          </button>
          <BackLink to="/search">Back to flights</BackLink>
        </div>
      </form>
    </FunnelPage>
  )
}

function TextField({
  label, value, onChange, onBlur, error, hint, type = 'text', autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string | null
  hint?: string
  type?: string
  autoComplete?: string
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <label className="block" htmlFor={id}>
      <span className="kx-label">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        data-invalid={error ? 'true' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="kx-input"
        style={error ? { borderBottomColor: 'var(--color-danger)' } : undefined}
      />
      {error && (
        <span id={`${id}-err`} className="mt-1 block" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-danger)' }}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={`${id}-hint`} className="mt-1 block" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}
