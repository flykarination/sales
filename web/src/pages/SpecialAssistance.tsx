import { Link } from 'react-router-dom'

/**
 * Special assistance.
 *
 * Written the way an airline has to write this: plainly, with the timings and
 * limits stated, and without making the traveller feel they are asking for a
 * favour. Everything here is free of charge, which is said once at the top
 * rather than repeated defensively next to every item.
 */

interface Service {
  title: string
  body: string
  detail?: string[]
}

const MOBILITY: Service[] = [
  {
    title: 'Wheelchair assistance through the airport',
    body:
      'We will meet you at the terminal entrance and take you through check-in, security and immigration to the aircraft door, and do the same in reverse on arrival.',
    detail: [
      'WCHR — you can walk short distances and manage steps, but need help over the longer distances inside the terminal.',
      'WCHS — you can walk short distances but cannot manage stairs.',
      'WCHC — you need to be carried to and from your seat.',
    ],
  },
  {
    title: 'Bringing your own wheelchair',
    body:
      'Your own wheelchair or mobility scooter travels free and does not count against your baggage allowance. You may keep it with you to the aircraft door, where it is taken into the hold and returned to you there on arrival.',
    detail: [
      'Battery-powered chairs are accepted. Tell us the battery type when you book — dry cell, gel and lithium batteries are each handled differently, and lithium batteries over 300 Wh need our agreement first.',
      'Bring the make and model, and let us know if it folds.',
    ],
  },
  {
    title: 'Seating on board',
    body:
      'We hold accessible aisle seats with a movable armrest on every flight and will assign one to you at no charge. Tell us at booking rather than at the gate, so the seat is still there.',
    detail: [
      'Emergency exit rows cannot be assigned to passengers needing assistance, as they must be able to help in an evacuation.',
      'An on-board wheelchair is carried on every widebody aircraft in our fleet.',
    ],
  },
]

const OTHER: Service[] = [
  {
    title: 'Blind and partially sighted passengers',
    body:
      'Our crew will give you an individual safety briefing, walk you to your seat and describe the cabin layout, and read the menu aloud. Guide dogs travel in the cabin free of charge.',
  },
  {
    title: 'Deaf and hard of hearing passengers',
    body:
      'Tell us at booking and the crew will make announcements to you directly rather than relying on the public address, including any change to boarding or gate.',
  },
  {
    title: 'Medical equipment and oxygen',
    body:
      'Portable oxygen concentrators, CPAP machines and nebulisers may be used on board. They do not count against your baggage allowance. We need to know the model at least 48 hours before departure.',
    detail: [
      'Bring enough battery for the whole journey plus three hours, as aircraft power cannot be relied on.',
      'We do not supply medical oxygen ourselves.',
    ],
  },
  {
    title: 'Travelling with a carer',
    body:
      'If you cannot attend to your own needs during the flight, you must travel with someone aged 16 or over who can. They are seated next to you at no extra cost.',
  },
  {
    title: 'Hidden disabilities',
    body:
      'Autism, dementia, anxiety and other non-visible conditions are covered by the same service. Ask for the sunflower lanyard at any Karination desk — our staff are trained to recognise it, and no explanation is needed.',
  },
]

export default function SpecialAssistance() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.05 }}>
        Special assistance
      </h1>
      <p className="mt-3" style={{ color: 'var(--color-ink-mute)', maxWidth: '52ch', fontSize: 'var(--text-lead)' }}>
        Every service on this page is free of charge, on every Karination
        flight. You do not need a medical certificate to ask for it.
      </p>

      {/* the one thing that changes the outcome */}
      <div
        className="mt-8"
        style={{
          borderLeft: '3px solid var(--color-spectrum-teal)',
          background: 'color-mix(in oklab, var(--color-spectrum-teal) 9%, transparent)',
          padding: '16px 18px',
          borderRadius: 'var(--radius-edge)',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Tell us at least 48 hours before departure</p>
        <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)', maxWidth: '58ch' }}>
          That is the notice we need to guarantee assistance is waiting for you.
          Ask for it when you book, or add it later using your booking reference
          on the <Link to="/manage" className="underline">manage booking</Link> page.
          We will still do everything we can with less notice, but we cannot
          promise equipment or staff will be free.
        </p>
      </div>

      <Group id="mobility" title="Mobility" items={MOBILITY} />
      <Group id="services" title="Other assistance" items={OTHER} />

      <section className="mt-14">
        <h2 className="font-display mb-4" style={{ fontSize: '1.7rem' }}>At the airport</h2>
        <ol style={{ borderTop: '2px solid var(--color-ink)' }}>
          {([
            ['Arrive a little earlier', 'Three hours before an international departure, two before a domestic one, so nothing is rushed.'],
            ['Find the assistance point', 'Every hub we serve has one at the terminal entrance and in the check-in hall. Press the call button and someone will come to you.'],
            ['Boarding', 'You board before other passengers, so you can settle without a queue behind you.'],
            ['On arrival', 'Stay in your seat until the cabin has cleared. Assistance meets you at the door and stays with you to the arrivals hall or your onward transport.'],
          ] as Array<[string, string]>).map(([t, d], i) => (
            <li key={t} className="flex gap-4 py-4" style={{ borderBottom: 'var(--rule)' }}>
              <span className="tnum font-mono" style={{ color: 'var(--color-aqua-deep)', minWidth: 24 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <strong style={{ display: 'block' }}>{t}</strong>
                <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="font-display mb-3" style={{ fontSize: '1.7rem' }}>Asking for assistance</h2>
        <p style={{ color: 'var(--color-ink-mute)', maxWidth: '58ch' }}>
          Add it to an existing booking with your reference and email, or tell
          any Karination desk. If something did not go the way it should have,
          tell us — we would rather know.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Link to="/manage" className="kx-cta">Add to a booking</Link>
          <Link
            to="/travel-info"
            style={{
              border: 'var(--rule)', padding: '14px 22px', minHeight: 52,
              borderRadius: 'var(--radius-edge)', fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-small)', letterSpacing: '0.16em',
              textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center',
            }}
          >
            Travel information
          </Link>
        </div>
      </section>
    </div>
  )
}

function Group({ id, title, items }: { id: string; title: string; items: Service[] }) {
  return (
    <section id={id} className="mt-14 scroll-mt-32">
      <h2 className="font-display mb-4" style={{ fontSize: '1.7rem' }}>{title}</h2>
      <div style={{ borderTop: '2px solid var(--color-ink)' }}>
        {items.map((s) => (
          <article key={s.title} className="py-5" style={{ borderBottom: 'var(--rule)' }}>
            <h3 style={{ fontSize: 'var(--text-lead)', fontWeight: 600, marginBottom: 6 }}>{s.title}</h3>
            <p style={{ color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>{s.body}</p>
            {s.detail && (
              <ul className="mt-3">
                {s.detail.map((d) => (
                  <li
                    key={d}
                    className="flex gap-3 py-1.5"
                    style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)', maxWidth: '62ch' }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6, height: 6, marginTop: 8, flex: 'none', borderRadius: 3,
                        background: 'var(--color-spectrum-teal)',
                      }}
                    />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
