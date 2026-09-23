import { Link } from 'react-router-dom'
import { CABIN_ORDER, CABINS } from '@/lib/cabins'
import { CARRIERS } from '@/data/carriers'
import { TOPICS } from '@/data/travel-topics'


const FAQ: Array<[string, string]> = [
  [
    'How early should I arrive?',
    'Two hours before departure for international flights, ninety minutes for domestic. Bag drop closes 60 minutes before departure and boarding closes 15 minutes before.',
  ],
  [
    'When does check-in open?',
    'Online check-in opens 48 hours before departure and stays open until 90 minutes before. You need your booking reference and the email you booked with.',
  ],
  [
    'Can I change or cancel a booking?',
    'Not yet. Karination sells a single fare per cabin with no change or refund conditions attached — what you see is what you pay, and what you book is what you fly.',
  ],
  [
    'Do you have fare classes or add-ons?',
    'No. One price per cabin, per passenger, one way. Nothing is sold on top of it.',
  ],
  [
    'Are the times shown in my time zone?',
    'No, and deliberately. Every departure and arrival is shown on the clock of the airport where it happens, the way a printed timetable does it. A "+1" beside an arrival means it lands the next day.',
  ],
  [
    'How do I earn miles?',
    'Join RainbowOne and book with the same email address. Miles are the distance flown multiplied by your cabin, plus your tier bonus, and they credit automatically. Or sign in when you book and add the booking to your account, and it earns for you whatever address is on it.',
  ],
  [
    'What if I need assistance?',
    'Wheelchair assistance, help with boarding, accessible seating and support for hidden disabilities are free on every Karination flight. Tell us at least 48 hours before departure — see the special assistance page for the full list and how to request it.',
  ],
]

const AIRPORT_STEPS: Array<[string, string]> = [
  ['Check in online', 'From 48 hours before departure. Bring your boarding pass on your phone.'],
  ['Bag drop', 'Closes 60 minutes before departure. Have your passport ready.'],
  ['Security and immigration', 'Allow longer at Tân Sơn Nhất and Nội Bài in the early morning.'],
  ['Boarding', 'Begins 40 minutes before departure and closes 15 minutes before.'],
]

export default function TravelInfo() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.05 }}>
        Travel information
      </h1>
      <p className="mt-3" style={{ color: 'var(--color-ink-mute)', maxWidth: '48ch' }}>
        Everything you need between booking and boarding.
      </p>

      <section className="mt-10">
        <h2 className="font-display mb-4" style={{ fontSize: '1.7rem' }}>Before you fly</h2>
        <ul className="grid gap-x-8 sm:grid-cols-2" style={{ borderTop: '2px solid var(--color-ink)' }}>
          {TOPICS.map((t) => (
            <li key={t.slug} className="min-w-0">
              <Link
                to={`/travel-info/${t.slug}`}
                className="kx-row flex min-w-0 items-baseline gap-3 py-3"
                style={{ borderBottom: 'var(--rule)', minHeight: 44 }}
              >
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: `var(${t.hue})`, flex: 'none' }} />
                <span className="min-w-0 truncate" style={{ fontWeight: 500 }}>{t.title}</span>
              </Link>
            </li>
          ))}
          <li className="min-w-0">
            <Link to="/special-assistance" className="kx-row flex min-w-0 items-baseline gap-3 py-3"
                  style={{ borderBottom: 'var(--rule)', minHeight: 44 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-spectrum-teal)', flex: 'none' }} />
              <span className="min-w-0 truncate" style={{ fontWeight: 500 }}>Special assistance</span>
            </Link>
          </li>
        </ul>
      </section>

      <section id="baggage" className="mt-14 scroll-mt-32">
        <h2 className="font-display mb-4" style={{ fontSize: '1.7rem' }}>Baggage</h2>
        <p className="mb-5" style={{ color: 'var(--color-ink-mute)', maxWidth: '60ch' }}>
          What is included in the fare. Each airline in the group sets its own
          allowance, and a KarinationGroup booking can include flights on more
          than one. A bag has to satisfy every airline that will carry it, so on
          a booking that mixes them the smaller allowance applies throughout —
          and we show it when you book.
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          {CARRIERS.map((carrier) => (
            <div key={carrier.code}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3"
                   style={{ borderBottom: `2px solid ${carrier.accent}`, paddingBottom: 6 }}>
                <h3 style={{ fontSize: 'var(--text-lead)', fontWeight: 600 }}>{carrier.name}</h3>
                <span className="font-mono uppercase"
                      style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-ink-faint)' }}>
                  {carrier.code}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="w-full" style={{ minWidth: 340, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-ink)' }}>
                      {['Cabin', 'Checked', 'Hand baggage'].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="py-2 text-left font-mono uppercase"
                          style={{
                            fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                            color: 'var(--color-ink-mute)', fontWeight: 400,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CABIN_ORDER.map((code) => {
                      const c = CABINS[code]
                      const b = carrier.baggage[code]
                      return (
                        <tr key={code} style={{ borderBottom: 'var(--rule)' }}>
                          <td className="py-3">
                            <span className="flex items-center gap-2">
                              <span aria-hidden style={{ width: 10, height: 10, background: c.hue, borderRadius: 2 }} />
                              <span style={{ fontWeight: 600, color: c.ink }}>{c.longName}</span>
                            </span>
                          </td>
                          <td className="tnum py-3 font-mono">{b.checked}</td>
                          <td className="tnum py-3 font-mono" style={{ color: 'var(--color-ink-mute)' }}>{b.hand}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {carrier.cabinExtra && (
                <p className="mt-2" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                  Plus, in every cabin, {carrier.cabinExtra}.
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="mt-5" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>
          RainbowOne Amber adds one checked bag; Amethyst and Ruby add two. Tier
          allowances apply on every airline in the group.
        </p>
        <p className="mt-2" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-faint)', maxWidth: '62ch' }}>
          FORZA carries less than we do, but every FORZA fare still includes a
          checked bag — which is the line between a lower-cost airline and a
          low-cost one. Sonder sits between the two, with its fan bag on top.
        </p>
      </section>

      <section id="airport" className="mt-14 scroll-mt-32">
        <h2 className="font-display mb-4" style={{ fontSize: '1.7rem' }}>At the airport</h2>
        <ol style={{ borderTop: '2px solid var(--color-ink)' }}>
          {AIRPORT_STEPS.map(([title, detail], i) => (
            <li key={title} className="flex gap-4 py-4" style={{ borderBottom: 'var(--rule)' }}>
              <span className="tnum font-mono" style={{ color: 'var(--color-aqua-deep)', minWidth: 24 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <strong style={{ display: 'block' }}>{title}</strong>
                <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>{detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section id="questions" className="mt-14 scroll-mt-32">
        <h2 className="font-display mb-4" style={{ fontSize: '1.7rem' }}>Questions</h2>
        <div style={{ borderTop: '2px solid var(--color-ink)' }}>
          {FAQ.map(([q, a]) => (
            <details key={q} className="kx-faq" style={{ borderBottom: 'var(--rule)' }}>
              <summary
                style={{
                  cursor: 'pointer', padding: '14px 0', fontWeight: 600,
                  minHeight: 44, listStyle: 'none', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', gap: 16,
                }}
              >
                {q}
                <span aria-hidden className="kx-faq-mark" style={{ color: 'var(--color-aqua-deep)' }}>+</span>
              </summary>
              <p style={{ paddingBottom: 16, color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
