import { Link } from 'react-router-dom'
import { STORY, MISSION } from '@/data/about'

/**
 * Our story.
 *
 * A timeline read top to bottom, with the spectrum running through it: each
 * chapter takes the next hue, so the colour is doing what it does everywhere
 * else on this site — carrying a dimension of the information rather than
 * decorating it. Here the dimension is time.
 */
export default function OurStory() {
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
            style={{ fontSize: 'clamp(2.2rem, 6vw, 4.5rem)', lineHeight: 1.02, color: 'var(--color-paper)', maxWidth: '16ch' }}
          >
            Thirty-eight years of going where nobody went.
          </h1>
          <p className="mt-6" style={{ color: '#B9B6D8', fontSize: 'var(--text-lead)', maxWidth: '56ch' }}>
            {MISSION}
          </p>
        </div>
      </section>

      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto max-w-4xl">
          <ol className="kx-timeline">
            {STORY.map((c) => (
              <li key={c.when} className="kx-chapter" style={{ ['--kx-chapter' as string]: c.hue }}>
                <p className="kx-chapter-when tnum font-mono">{c.when}</p>
                <h2 className="font-display kx-chapter-title" style={{ color: c.ink }}>
                  {c.title}
                </h2>
                <p style={{ color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>{c.body}</p>
                {c.detail && (
                  <p
                    className="mt-3"
                    style={{
                      color: 'var(--color-ink)',
                      fontSize: 'var(--text-small)',
                      maxWidth: '58ch',
                      borderLeft: `2px solid ${c.hue}`,
                      paddingLeft: 12,
                    }}
                  >
                    {c.detail}
                  </p>
                )}

                {/* Where the record contradicts itself, all of it is printed
                    and none of it is picked. */}
                {c.accounts && (
                  <div className="mt-6">
                    <p
                      className="mb-3 font-mono uppercase"
                      style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.18em', color: 'var(--color-ink-faint)' }}
                    >
                      Where the name comes from · three accounts
                    </p>
                    <ul className="grid gap-4 md:grid-cols-3">
                      {c.accounts.map((a) => (
                        <li
                          key={a.label}
                          style={{
                            borderTop: `3px solid ${a.hue}`,
                            paddingTop: 12,
                          }}
                        >
                          <p
                            className="mb-2 font-mono uppercase"
                            style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: a.ink, fontWeight: 600 }}
                          >
                            {a.label}
                          </p>
                          <p style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)' }}>
                            {a.text}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <p
                      className="mt-4"
                      style={{ color: 'var(--color-ink)', fontSize: 'var(--text-small)', maxWidth: '58ch' }}
                    >
                      All three are in the archive. None of them can be proved, and
                      we have stopped trying.
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ol>

          <nav className="mt-16 flex flex-wrap gap-x-8 gap-y-3" style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 16 }}>
            <Link to="/about/what-we-believe" className="kx-navlink">What we believe →</Link>
            <Link to="/network" className="kx-navlink" style={{ color: 'var(--color-ink-mute)' }}>
              The route map
            </Link>
            <Link to="/fleet" className="kx-navlink" style={{ color: 'var(--color-ink-mute)' }}>
              The fleet today
            </Link>
          </nav>
        </div>
      </section>
    </div>
  )
}
