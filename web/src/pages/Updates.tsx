import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { marked } from 'marked'
import {
  CATEGORY_STYLE, UPDATES, isExpired, updateBySlug,
  type TravelUpdate, type UpdateCategory,
} from '@/data/updates'
import { airportLabel } from '@/data/airports'
import { longDate } from '@/lib/format'
import { assetUrl } from '@/lib/assets'

/**
 * Travel updates.
 *
 * Everything here is built from Markdown files in /content/updates, so the
 * airline can publish by committing a file — see that folder's README. This
 * page renders both the list and a single post; they share so much furniture
 * that splitting them would only duplicate it.
 */

marked.setOptions({ gfm: true, breaks: false })

export default function Updates() {
  const { slug } = useParams()
  return slug ? <SinglePost slug={slug} /> : <UpdateList />
}

/* ------------------------------------------------------------------ */

function UpdateList() {
  const [filter, setFilter] = useState<UpdateCategory | 'ALL'>('ALL')

  const shown = useMemo(
    () => (filter === 'ALL' ? UPDATES : UPDATES.filter((u) => u.category === filter)),
    [filter],
  )

  // Only offer a filter for categories that have something in them; an empty
  // filter chip is a promise the page cannot keep.
  const present = useMemo(() => {
    const seen = new Set(UPDATES.map((u) => u.category))
    return (Object.keys(CATEGORY_STYLE) as UpdateCategory[]).filter((c) => seen.has(c))
  }, [])

  const live = UPDATES.filter((u) => !isExpired(u)).length

  return (
    <div>
      <section className="on-ink px-5 py-14 md:px-8 md:py-20" style={{ background: 'var(--color-ink)' }}>
        <div className="mx-auto max-w-4xl">
          <p className="mb-5 font-mono uppercase"
             style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.24em', color: 'var(--color-aqua)' }}>
            Travel updates
          </p>
          <h1 className="font-display"
              style={{ fontSize: 'clamp(2rem,5.5vw,4rem)', lineHeight: 1.04, color: 'var(--color-paper)', maxWidth: '18ch' }}>
            What is happening on the network.
          </h1>
          <p className="mt-5" style={{ color: '#B9B6D8', maxWidth: '56ch' }}>
            Disruption, route changes and anything else worth knowing before you
            travel. {live} current {live === 1 ? 'update' : 'updates'}. For your
            own flight, {' '}
            <Link to="/flight-status" style={{ color: 'var(--color-aqua)' }}>check its status</Link>.
          </p>
        </div>
      </section>

      <section className="px-5 py-12 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter updates">
            {(['ALL', ...present] as const).map((key) => {
              const on = filter === key
              const hue = key === 'ALL' ? 'var(--color-ink)' : CATEGORY_STYLE[key].hue
              return (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-pressed={on}
                  className="inline-flex items-center gap-2 font-mono uppercase"
                  style={{
                    fontSize: 'var(--text-micro)', letterSpacing: '0.12em',
                    padding: '8px 12px', minHeight: 40, borderRadius: 'var(--radius-edge)',
                    border: `1px solid ${on ? 'var(--color-ink)' : 'var(--color-paper-edge)'}`,
                    background: on ? 'var(--color-paper-sunk)' : 'transparent',
                    color: 'var(--color-ink)',
                  }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: hue }} />
                  {key === 'ALL' ? 'Everything' : CATEGORY_STYLE[key].label}
                </button>
              )
            })}
          </div>

          {shown.length === 0 ? (
            <p style={{ color: 'var(--color-ink-mute)' }}>
              Nothing to report here. That is usually good news.
            </p>
          ) : (
            <ul style={{ borderTop: '2px solid var(--color-ink)' }}>
              {shown.map((u) => (
                <li key={u.slug} style={{ borderBottom: 'var(--rule)' }}>
                  <Link
                    to={`/updates/${u.slug}`}
                    className="kx-row block py-5"
                    style={{ borderLeft: `3px solid ${CATEGORY_STYLE[u.category].hue}`, paddingLeft: 14 }}
                  >
                    <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Badge update={u} />
                      <time
                        className="tnum font-mono"
                        dateTime={u.date}
                        style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}
                      >
                        {longDate(u.date)}
                      </time>
                    </div>
                    <h2 style={{ fontSize: 'var(--text-lead)', fontWeight: 600, marginBottom: 4 }}>
                      {u.title}
                    </h2>
                    {u.summary && (
                      <p style={{ color: 'var(--color-ink-mute)', maxWidth: '64ch' }}>{u.summary}</p>
                    )}
                    <AirportTags codes={u.airports} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SinglePost({ slug }: { slug: string }) {
  const update = updateBySlug.get(slug)
  const onProseClick = useProseNavigation()

  const html = useMemo(
    () => (update ? withRoutedLinks(marked.parse(update.body) as string) : ''),
    [update],
  )

  if (!update) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 md:px-8">
        <h1 className="font-display" style={{ fontSize: '2rem' }}>That update is not here.</h1>
        <p className="mt-3" style={{ color: 'var(--color-ink-mute)' }}>
          It may have been taken down. See{' '}
          <Link to="/updates" className="underline">all travel updates</Link>.
        </p>
      </div>
    )
  }

  const style = CATEGORY_STYLE[update.category]

  return (
    <article className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <p className="mb-4 font-mono uppercase"
         style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.22em', color: style.ink }}>
        <Link to="/updates">Travel updates</Link>
      </p>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge update={update} />
        <time className="tnum font-mono" dateTime={update.date}
              style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-faint)' }}>
          {longDate(update.date)}
        </time>
      </div>

      <h1 className="font-display" style={{ fontSize: 'clamp(1.9rem,4.6vw,3rem)', lineHeight: 1.06 }}>
        {update.title}
      </h1>

      {update.summary && (
        <p className="mt-4" style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--text-lead)', maxWidth: '58ch' }}>
          {update.summary}
        </p>
      )}

      <AirportTags codes={update.airports} />

      {isExpired(update) && (
        <p className="mt-6"
           style={{
             borderLeft: '3px solid var(--color-ink-faint)', paddingLeft: 12,
             color: 'var(--color-ink-mute)', fontSize: 'var(--text-small)',
           }}>
          This update is no longer current. It applied until {longDate(update.until!)} and
          is kept here for reference.
        </p>
      )}

      {/* Posts are written by the airline in its own repository, so the
          Markdown is trusted content, not user input. Clicks are caught here
          so a link written as [Manage booking](/manage) routes in-app rather
          than reloading the whole site. */}
      <div
        className="kx-prose mt-8"
        style={{ ['--kx-accent' as string]: style.hue }}
        onClick={onProseClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <nav className="mt-14" style={{ borderTop: '2px solid var(--color-ink)', paddingTop: 14 }}>
        <Link to="/updates" className="kx-navlink" style={{ fontSize: 'var(--text-small)' }}>
          ← All travel updates
        </Link>
      </nav>
    </article>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Rewrite site-relative links to sit under the deployment base.
 *
 * A post writes [your account](/account), which is what an author would
 * naturally type. On GitHub Pages the app is served from /sales/, so that
 * bare path would leave the app entirely and 404. Anything absolute — an
 * external link, a mailto — is left alone.
 */
function withRoutedLinks(html: string): string {
  return html.replace(/href="\/(?!\/)/g, `href="${assetUrl('/')}`)
}

/** Keep in-app links inside the router instead of reloading the document. */
function useProseNavigation() {
  const navigate = useNavigate()
  return (e: React.MouseEvent<HTMLDivElement>) => {
    // let the browser handle modified clicks: new tab, download, etc.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    const anchor = (e.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href') ?? ''
    const base = assetUrl('/')
    if (!href.startsWith(base)) return
    e.preventDefault()
    navigate(href.slice(base.length - 1) || '/')
  }
}

function Badge({ update }: { update: TravelUpdate }) {
  const style = CATEGORY_STYLE[update.category]
  const gone = isExpired(update)
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="font-mono uppercase"
        style={{
          fontSize: 'var(--text-micro)', letterSpacing: '0.14em',
          color: gone ? 'var(--color-ink-faint)' : style.ink, fontWeight: 600,
        }}
      >
        <span aria-hidden
              style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 2,
                marginRight: 6, background: gone ? 'var(--color-ink-faint)' : style.hue,
              }} />
        {style.label}
      </span>
      {gone && (
        <span className="font-mono uppercase"
              style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.14em', color: 'var(--color-ink-faint)' }}>
          · Expired
        </span>
      )}
    </span>
  )
}

function AirportTags({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {codes.map((code) => (
        <li
          key={code}
          className="tnum font-mono"
          style={{
            fontSize: 'var(--text-micro)', padding: '4px 8px',
            border: 'var(--rule)', borderRadius: 'var(--radius-edge)',
            color: 'var(--color-ink-mute)',
          }}
        >
          {code} <span style={{ color: 'var(--color-ink-faint)' }}>{airportLabel(code)}</span>
        </li>
      ))}
    </ul>
  )
}
