import { Link, useParams } from 'react-router-dom'
import { TOPICS, topicBySlug, type TopicSection } from '@/data/travel-topics'

/**
 * One renderer for every travel information topic, so the whole section keeps
 * a single shape. The topic supplies an accent hue; everything else is the
 * same furniture in the same order.
 */
export default function TravelTopic() {
  const { slug } = useParams()
  const topic = slug ? topicBySlug.get(slug) : undefined

  if (!topic) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 md:px-8">
        <h1 className="font-display" style={{ fontSize: '2rem' }}>We haven't written that one.</h1>
        <p className="mt-3" style={{ color: 'var(--color-ink-mute)' }}>
          Try <Link to="/travel-info" className="underline">travel information</Link> for everything we have.
        </p>
      </div>
    )
  }

  const others = TOPICS.filter((t) => t.slug !== topic.slug)

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <p
        className="mb-3 font-mono uppercase"
        style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.22em', color: `var(${topic.hue})` }}
      >
        <Link to="/travel-info">Travel information</Link>
      </p>
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.05 }}>
        {topic.title}
      </h1>
      <p className="mt-4" style={{ color: 'var(--color-ink-mute)', maxWidth: '58ch', fontSize: 'var(--text-lead)' }}>
        {topic.standfirst}
      </p>

      {topic.sections.map((s) => (
        <Section key={s.heading} section={s} hue={topic.hue} />
      ))}

      <nav aria-label="Other topics" className="mt-16">
        <h2
          className="mb-4 font-mono uppercase"
          style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.2em', color: 'var(--color-ink-mute)' }}
        >
          More travel information
        </h2>
        <ul className="grid gap-x-8 sm:grid-cols-2" style={{ borderTop: '2px solid var(--color-ink)' }}>
          {others.map((t) => (
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
        </ul>
      </nav>
    </div>
  )
}

function Section({ section, hue }: { section: TopicSection; hue: string }) {
  return (
    <section className="mt-12">
      <h2 className="font-display mb-3" style={{ fontSize: '1.6rem' }}>{section.heading}</h2>

      {section.body && (
        <p style={{ color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>{section.body}</p>
      )}

      {section.points && (
        <ul className="mt-4">
          {section.points.map((p) => (
            <li
              key={p}
              className="flex gap-3 py-2"
              style={{ borderTop: 'var(--rule)', maxWidth: '64ch' }}
            >
              <span
                aria-hidden
                style={{ width: 6, height: 6, marginTop: 9, flex: 'none', borderRadius: 3, background: `var(${hue})` }}
              />
              <span style={{ color: 'var(--color-ink)' }}>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {section.table && (
        <div className="mt-4" style={{ overflowX: 'auto' }}>
          <table className="w-full" style={{ minWidth: 460, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-ink)' }}>
                {section.table.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="py-2 pr-6 text-left font-mono uppercase"
                    style={{
                      fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
                      color: 'var(--color-ink-mute)', fontWeight: 400,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row.join('|')} style={{ borderBottom: 'var(--rule)' }}>
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className="py-3 pr-6"
                      style={{
                        fontWeight: i === 0 ? 600 : 400,
                        color: i === 0 ? 'var(--color-ink)' : 'var(--color-ink-mute)',
                        verticalAlign: 'top',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.callout && (
        <div
          className="mt-5"
          style={{
            borderLeft: `3px solid var(${hue})`,
            background: `color-mix(in oklab, var(${hue}) 9%, transparent)`,
            padding: '14px 16px',
            borderRadius: 'var(--radius-edge)',
            maxWidth: '64ch',
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{section.callout.title}</p>
          <p style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
            {section.callout.body}
          </p>
        </div>
      )}
    </section>
  )
}
