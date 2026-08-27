import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { assetUrl } from '@/lib/assets'

const NAV = [
  { label: 'Book', href: '/' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'Route map', href: '/network' },
  { label: 'Check in', href: '/checkin' },
  { label: 'Flight status', href: '/flight-status' },
  { label: 'RainbowOne', href: '/rainbowone' },
]

export function SiteHeader() {
  const { user } = useAuth()
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
          <img
            src={assetUrl('/brand/wordmark.png')}
            alt="Karination"
            style={{ height: 22, width: 'auto' }}
          />
        </Link>

        <nav aria-label="Main" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-5 lg:gap-7">
            {NAV.map((item) => (
              <li key={item.label}>
                <NavLink
                  to={item.href}
                  className="kx-navlink"
                  style={({ isActive }) => ({
                    fontSize: 'var(--text-small)',
                    color: isActive ? 'var(--color-ink)' : 'var(--color-ink-mute)',
                    fontWeight: isActive ? 600 : 400,
                  })}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          to={user ? '/account' : '/manage'}
          className="ml-auto md:ml-0"
          style={{
            fontSize: 'var(--text-small)',
            fontWeight: 600,
            color: 'var(--color-ink)',
            border: '1px solid var(--color-paper-edge)',
            borderRadius: 'var(--radius-edge)',
            padding: '9px 14px',
            minHeight: 40,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {user ? 'My account' : 'Manage booking'}
        </Link>
      </div>
    </header>
  )
}
