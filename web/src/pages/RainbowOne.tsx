import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEarnRates, listTiers, type EarnRateRow, type TierRow } from '@/lib/queries'
import { useAuth } from '@/auth/AuthContext'
import { CABINS, type CabinCode } from '@/lib/cabins'
import { count } from '@/lib/format'
import { assetUrl } from '@/lib/assets'

export default function RainbowOne() {
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [rates, setRates] = useState<EarnRateRow[]>([])
  const { user } = useAuth()

  useEffect(() => {
    let live = true
    listTiers().then(({ data }) => { if (live && data) setTiers(data) })
    listEarnRates().then(({ data }) => { if (live && data) setRates(data) })
    return () => { live = false }
  }, [])

  const rateFor = (code: string) => rates.find((r) => r.cabin_code === code)?.multiplier

  return (
    <div>
      {/* ---- opening -------------------------------------------------- */}
      <section className="on-ink px-5 py-16 md:px-8 md:py-24" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-6 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}
          >
            RainbowOne
          </p>
          <h1
            className="font-display"
            style={{ fontSize: 'clamp(2.2rem, 6.5vw, 5rem)', lineHeight: 1.0, color: 'var(--color-paper)', maxWidth: '15ch' }}
          >
            Join our RainbowOne family.
          </h1>
          <p className="mt-6" style={{ color: '#B9B6D8', fontSize: 'var(--text-lead)', maxWidth: '54ch' }}>
            Every kilometre you fly with Karination earns miles — more in the
            cabins up front, more again as you climb. Four tiers, each one named
            for a colour we fly under. It costs nothing to join.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            {user ? (
              <Link to="/account" className="kx-cta">Go to your account</Link>
            ) : (
              <>
                <Link to="/join" className="kx-cta">Join free</Link>
                <Link
                  to="/signin"
                  style={{
                    border: '1px solid rgba(255,255,255,.25)', color: 'var(--color-paper)',
                    padding: '14px 22px', minHeight: 52, borderRadius: 'var(--radius-edge)',
                    display: 'inline-flex', alignItems: 'center', letterSpacing: '0.16em',
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-small)', textTransform: 'uppercase',
                  }}
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ---- the tiers ------------------------------------------------ */}
      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display mb-2" style={{ fontSize: 'clamp(1.7rem, 4vw, 2.6rem)' }}>
            Four colours to fly under
          </h2>
          <p className="mb-9" style={{ color: 'var(--color-ink-mute)', maxWidth: '52ch' }}>
            Tiers are earned on qualifying miles in a membership year. You start
            at Jade the moment you join.
          </p>

          <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((t) => (
              <li key={t.tier_code} style={{ borderTop: `3px solid var(${t.hue_token})`, paddingTop: 16 }}>
                <div className="flex items-baseline gap-3">
                  <h3 className="font-display" style={{ fontSize: '1.7rem', color: `var(${t.hue_token})` }}>
                    {t.tier_name}
                  </h3>
                  <span
                    className="font-mono uppercase"
                    style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-ink-faint)' }}
                  >
                    Tier {t.tier_rank}
                  </span>
                </div>
                {t.tagline && (
                  <p className="mt-1" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)', fontStyle: 'italic' }}>
                    {t.tagline}
                  </p>
                )}
                <p className="tnum mt-4 font-mono" style={{ fontSize: 'var(--text-lead)' }}>
                  {t.qualifying_miles_required === 0 ? 'On joining' : `${count(t.qualifying_miles_required)} miles`}
                </p>
                {Number(t.earn_bonus_pct) > 0 && (
                  <p className="tnum font-mono" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                    +{Number(t.earn_bonus_pct)}% bonus miles
                  </p>
                )}
                <ul className="mt-4">
                  {(t.perks ?? []).map((p) => (
                    <li
                      key={p}
                      className="py-1.5"
                      style={{ fontSize: 'var(--text-small)', borderTop: 'var(--rule)', color: 'var(--color-ink)' }}
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- how earning works ---------------------------------------- */}
      <section className="px-5 py-16 md:px-8" style={{ background: 'var(--color-paper-sunk)' }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display mb-2" style={{ fontSize: 'clamp(1.7rem, 4vw, 2.6rem)' }}>
            How you earn
          </h2>
          <p className="mb-8" style={{ color: 'var(--color-ink-mute)', maxWidth: '56ch' }}>
            Miles are the distance you actually fly, multiplied by the cabin you
            fly it in, plus your tier bonus. No fare classes to decode.
          </p>

          <p
            className="tnum mb-9 font-mono"
            style={{ fontSize: 'clamp(0.9rem, 2.4vw, 1.25rem)', color: 'var(--color-ink)' }}
          >
            distance (km) × cabin × (1 + tier bonus) = miles
          </p>

          <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
            {(['FIRST', 'BUSINESS', 'PREMIUM_ECONOMY', 'ECONOMY'] as CabinCode[]).map((code) => {
              const c = CABINS[code]
              const m = rateFor(code)
              return (
                <li key={code} className="flex flex-wrap items-baseline gap-x-5 py-4" style={{ borderBottom: 'var(--rule)' }}>
                  <span aria-hidden style={{ width: 14, height: 14, background: c.hue, borderRadius: 3, flex: 'none' }} />
                  <span style={{ fontWeight: 600, color: c.ink, minWidth: '10rem' }}>{c.longName}</span>
                  <span className="tnum font-mono" style={{ fontSize: 'var(--text-lead)' }}>
                    {m ? `×${Number(m)}` : '—'}
                  </span>
                  <span className="ml-auto tnum font-mono" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
                    {m ? `${count(Math.round(8774 * Number(m)))} miles on SGN–KGD` : ''}
                  </span>
                </li>
              )
            })}
          </ul>

          <p className="mt-6" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-faint)', maxWidth: '58ch' }}>
            Example based on TP Hồ Chí Minh to Kaliningrad, 8,774 km. Earning begins the
            day you join — flights taken before then are not credited.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6">
          <img src={assetUrl('/brand/tagline.png')} alt="Colour your dreams" style={{ maxWidth: 300, height: 'auto' }} />
          {!user && <Link to="/join" className="kx-cta ml-auto">Join RainbowOne free</Link>}
        </div>
      </section>
    </div>
  )
}
