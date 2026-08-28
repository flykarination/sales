import { Link } from 'react-router-dom'
import { BELIEFS, MISSION } from '@/data/about'

/**
 * What we believe.
 *
 * Three claims, and each one paired with something on this site that shows it
 * rather than asserts it. A values page that cannot point at anything is a
 * poster; the whole reason this one is worth having is that the route map and
 * the fleet list are one click away and will either back it up or not.
 */
export default function WhatWeBelieve() {
  return (
    <div>
      <section className="on-ink px-5 py-16 md:px-8 md:py-24" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-4xl">
          <p
            className="mb-6 font-mono uppercase"
            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}
          >
            <Link to="/about">About Karination</Link>
          </p>
          <h1
            className="font-display"
            style={{ fontSize: 'clamp(1.9rem, 4.6vw, 3.4rem)', lineHeight: 1.08, color: 'var(--color-paper)', maxWidth: '24ch' }}
          >
            {MISSION}
          </h1>
          <p className="mt-6" style={{ color: '#B9B6D8', maxWidth: '56ch' }}>
            That is the whole of it. Everything below follows from it, and
            everything below can be checked against the rest of this site.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto max-w-4xl">
          <ol>
            {BELIEFS.map((b, i) => (
              <li key={b.title} className="mb-14">
                <div className="mb-3 flex items-baseline gap-4">
                  <span
                    className="tnum font-mono"
                    style={{ fontSize: 'var(--text-small)', color: b.ink, fontWeight: 600 }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-display" style={{ fontSize: 'clamp(1.6rem, 3.6vw, 2.3rem)', lineHeight: 1.12 }}>
                    {b.title}
                  </h2>
                </div>

                <p style={{ color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>{b.body}</p>

                <div
                  className="mt-5"
                  style={{
                    borderLeft: `3px solid ${b.hue}`,
                    paddingLeft: 16,
                    maxWidth: '58ch',
                  }}
                >
                  <p
                    className="mb-1 font-mono uppercase"
                    style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: b.ink }}
                  >
                    How you can tell
                  </p>
                  <p style={{ color: 'var(--color-ink)' }}>{b.evidence}</p>
                  <Link
                    to={b.evidenceHref}
                    className="kx-navlink mt-2 inline-block"
                    style={{ fontSize: 'var(--text-small)' }}
                  >
                    {b.evidenceLabel} →
                  </Link>
                </div>
              </li>
            ))}
          </ol>

          <nav style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 16 }}>
            <Link to="/about/our-story" className="kx-navlink">Our story →</Link>
          </nav>
        </div>
      </section>
    </div>
  )
}
