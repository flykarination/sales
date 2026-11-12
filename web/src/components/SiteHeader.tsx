import { useEffect, useState } from 'react'
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
    owns: ['/travel-info', '/flight-status', '/special-assistance', '/updates'],
    children: [
      { label: 'Travel updates', to: '/updates' },
      { label: 'Connecting through Vietnam', to: '/travel-info/connecting-in-vietnam' },
      { label: 'Baggage', to: '/travel-info#baggage' },
      { label: 'Travel documents', to: '/travel-info/travel-documents' },
      { label: 'Children and infants', to: '/travel-info/children-and-infants' },
      { label: 'What you cannot pack', to: '/travel-info/restricted-items' },
      { label: 'Travelling with animals', to: '/travel-info/pets' },
      { label: 'Health and fitness to fly', to: '/travel-info/health' },
      { label: 'Delays and cancellations', to: '/travel-info/disruption' },
      { label: 'Baggage claim', to: '/travel-info/baggage-claim' },
      { label: 'Special assistance', to: '/special-assistance' },
      { label: 'Flight status', to: '/flight-status' },
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
    label: 'About', to: '/about', owns: ['/about', '/fleet', '/partners', '/cabins'],
    children: [
      { label: 'About us', to: '/about' },
      { label: 'Our story', to: '/about/our-story' },
      { label: 'What we believe', to: '/about/what-we-believe' },
      { label: 'On board', to: '/cabins' },
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
  // The phone menu remembers the page it was opened on, so it is closed by
  // definition once the page changes -- no effect needed to close it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof next === 'function' ? next(open) : next) ? pathname : null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenOn(null) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  return (
    // v2: solid night on every page, day or night below it -- the strongest
    // contrast the brand has, and the one constant as the territories change.
    <header className="kx-header">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-5 py-2.5 md:px-10">
        <Link to="/" className="relative z-[60] flex-none" aria-label="Karination, home">
          <img src={assetUrl('/brand/v2/kx-wordmark-white.png')} alt="Karination" width={1571} height={171}
               style={{ height: 17, width: 'auto' }} />
        </Link>

        <nav aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-6 xl:gap-8">
            {SECTIONS.map((s) => {
              const on = active?.label === s.label
              const hasMenu = s.children.length > 1
              return (
                <li key={s.label} className={hasMenu ? 'kx-navitem' : undefined}>
                  <NavLink to={s.to} className="kx-header-link" data-on={on || undefined}
                           aria-current={on ? 'page' : undefined} aria-haspopup={hasMenu || undefined}>
                    {s.label}
                  </NavLink>

                  {/* Opens under its own item on hover or keyboard focus, and
                      closes when focus leaves. */}
                  {hasMenu && (
                    <div className="kx-menu" aria-label={`${s.label} pages`}>
                      <ul className="kx-menu-panel">
                        {s.children.map((c) => {
                          const [path, hash] = c.to.split('#')
                          const here = pathname === path && !hash
                          return (
                            <li key={c.to}>
                              <Link to={c.to} className="kx-menulink" data-here={here || undefined}
                                    style={{ fontWeight: here ? 600 : 400 }}>
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

        {/* on phones it lives in the menu; there is no room for it beside the logo */}
        <Link to={user ? '/account' : '/manage'} className="kx-header-cta ml-auto hidden whitespace-nowrap sm:inline-flex lg:ml-0">
          {user ? 'My account' : 'Manage booking'}
        </Link>

        <button
          type="button"
          className="relative z-[60] ml-auto flex h-11 w-11 items-center justify-center rounded-full sm:ml-0 lg:hidden"
          style={{ border: '1px solid rgba(244,247,255,0.3)', color: '#FFFFFF' }}
          aria-expanded={open}
          aria-controls="kx-mobilemenu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
            {open
              ? <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              : <path d="M2 5h14M2 9h14M2 13h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
          </svg>
        </button>
      </div>

      {open && (
        <div id="kx-mobilemenu" className="kx-mobilemenu lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <ul>
            {SECTIONS.map((s, i) => (
              <li key={s.label}>
                <Link to={s.to} className="kx-mm-big" style={{ animationDelay: `${i * 45}ms` }}>
                  {s.label}
                </Link>
                {s.children.length > 1 && (
                  <ul className="mb-4 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {s.children.map((c) => (
                      <li key={c.to}>
                        <Link to={c.to} style={{ color: '#B7C3E0', fontSize: 'var(--text-small)', minHeight: 36, display: 'inline-flex', alignItems: 'center' }}>
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
