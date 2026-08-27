import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { assetUrl } from '@/lib/assets'

interface SubItem {
  label: string
  /** A route, or a '#anchor' within the section's own page. */
  to: string
}

interface NavSection {
  label: string
  to: string
  /** Every route that belongs to this section, so the sub-bar stays up. */
  owns: string[]
  children: SubItem[]
}

/**
 * Top-level sections, each with the pages that sit under it. A section shows
 * its children in a second bar rather than crowding the top row — the same
 * shape an airline site uses when one tab covers several pages.
 */
const SECTIONS: NavSection[] = [
  {
    label: 'Book', to: '/', owns: ['/', '/search', '/passengers', '/payment', '/confirmation'],
    children: [
      { label: 'Search flights', to: '/' },
      { label: 'Timetable', to: '/timetable' },
      { label: 'Manage booking', to: '/manage' },
    ],
  },
  {
    label: 'Destinations', to: '/destinations', owns: ['/destinations', '/network', '/timetable'],
    children: [
      { label: 'All destinations', to: '/destinations' },
      { label: 'Route map', to: '/network' },
      { label: 'Timetable', to: '/timetable' },
    ],
  },
  {
    label: 'Check in', to: '/checkin', owns: ['/checkin'],
    children: [{ label: 'Check in', to: '/checkin' }],
  },
  {
    label: 'Travel information', to: '/travel-info',
    owns: ['/travel-info', '/flight-status', '/special-assistance'],
    children: [
      { label: 'Baggage', to: '/travel-info#baggage' },
      { label: 'At the airport', to: '/travel-info#airport' },
      { label: 'Flight status', to: '/flight-status' },
      { label: 'Special assistance', to: '/special-assistance' },
      { label: 'Questions', to: '/travel-info#questions' },
    ],
  },
  {
    label: 'RainbowOne', to: '/rainbowone', owns: ['/rainbowone', '/join', '/signin', '/account'],
    children: [
      { label: 'The programme', to: '/rainbowone' },
      { label: 'Join free', to: '/join' },
      { label: 'Your account', to: '/account' },
    ],
  },
  {
    label: 'About', to: '/about', owns: ['/about', '/fleet', '/partners'],
    children: [
      { label: 'About us', to: '/about' },
      { label: 'Our fleet', to: '/fleet' },
      { label: 'Partners', to: '/partners' },
    ],
  },
]

function sectionFor(pathname: string): NavSection | undefined {
  // deepest match wins, so /destinations/HKG stays under Destinations
  return (
    SECTIONS.find((s) => s.owns.some((p) => p !== '/' && pathname.startsWith(p))) ??
    SECTIONS.find((s) => s.owns.includes(pathname))
  )
}

export function SiteHeader() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const active = sectionFor(pathname)

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: 'color-mix(in oklab, var(--color-paper) 92%, transparent)',
        backdropFilter: 'blur(10px)',
        borderBottom: 'var(--rule)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3 md:px-8">
        <Link to="/" className="flex-none" aria-label="Karination, home">
          <img src={assetUrl('/brand/wordmark.png')} alt="Karination" style={{ height: 22, width: 'auto' }} />
        </Link>

        <nav aria-label="Main" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-5 lg:gap-7">
            {SECTIONS.map((s) => {
              const on = active?.label === s.label
              const hasMenu = s.children.length > 1
              return (
                <li key={s.label} className={hasMenu ? 'kx-navitem' : undefined}>
                  <NavLink
                    to={s.to}
                    className="kx-navlink"
                    aria-haspopup={hasMenu || undefined}
                    style={{
                      fontSize: 'var(--text-small)',
                      color: on ? 'var(--color-ink)' : 'var(--color-ink-mute)',
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {s.label}
                  </NavLink>

                  {/* Opens under its own item on hover or keyboard focus, and
                      closes when focus leaves — no second bar taking up the
                      page. The pad above the panel bridges the gap so the
                      pointer can travel into it without it collapsing. */}
                  {hasMenu && (
                    <div className="kx-menu" aria-label={`${s.label} pages`}>
                      <ul className="kx-menu-panel">
                        {s.children.map((c) => {
                          const [path, hash] = c.to.split('#')
                          const here = pathname === path && !hash
                          return (
                            <li key={c.to}>
                              <Link
                                to={c.to}
                                className="kx-menulink"
                                style={{
                                  color: here ? 'var(--color-ink)' : 'var(--color-ink-mute)',
                                  fontWeight: here ? 600 : 400,
                                }}
                              >
                                {c.label}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <Link
          to={user ? '/account' : '/manage'}
          className="ml-auto md:ml-0"
          style={{
            fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--color-ink)',
            border: '1px solid var(--color-paper-edge)', borderRadius: 'var(--radius-edge)',
            padding: '9px 14px', minHeight: 40, display: 'inline-flex', alignItems: 'center',
          }}
        >
          {user ? 'My account' : 'Manage booking'}
        </Link>
      </div>

    </header>
  )
}
