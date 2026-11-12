import { Link } from 'react-router-dom'
import { assetUrl } from '@/lib/assets'

/** The site's links, grouped the way the header's sections are. */
const GROUPS: Array<[string, Array<[string, string]>]> = [
  ['Book', [['/', 'Search flights'], ['/manage', 'Manage booking'], ['/checkin', 'Check in'], ['/flight-status', 'Flight status']]],
  ['Fly', [['/destinations', 'Destinations'], ['/network', 'Route map'], ['/timetable', 'Timetable'], ['/updates', 'Travel updates']]],
  ['Travel', [['/travel-info', 'Travel information'], ['/travel-info/connecting-in-vietnam', 'Connecting through Vietnam'], ['/special-assistance', 'Special assistance'], ['/rainbowone', 'RainbowOne']]],
  ['Karination', [['/about', 'About us'], ['/about/our-story', 'Our story'], ['/about/what-we-believe', 'What we believe'], ['/cabins', 'On board'], ['/fleet', 'Our fleet'], ['/partners', 'Partners']]],
]

/**
 * v2 footer: always night, whatever the page above it, with the fluoro
 * along its top edge and the wordmark set huge at the foot -- the way a
 * signature closes a letter.
 */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden px-5 pt-14 md:px-8" style={{ background: '#010B1E', color: '#FFFFFF' }}>
      <span aria-hidden className="absolute inset-x-0 top-0" style={{ height: 2, background: 'var(--paint-fluoro)' }} />

      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_repeat(4,1fr)]">
        <div>
          <img src={assetUrl('/brand/v2/kx-wordmark-white.png')} alt="Karination" width={1571} height={171} style={{ height: 16, width: 'auto' }} />
          <div className="mt-6 flex items-center gap-3">
            <img src={assetUrl('/brand/echo-aegis.png')} alt="" style={{ height: 22, width: 'auto', borderRadius: 5 }} />
            <span style={{ color: '#B7C3E0', fontSize: 'var(--text-micro)' }}>KX · A member of Echo Aegis</span>
          </div>
        </div>

        {GROUPS.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="kx-eyebrow mb-3" style={{ color: '#8E9CC2' }}>{title}</p>
            <ul className="space-y-2">
              {links.map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="kx-footer-link" style={{ color: '#E6ECFA', fontSize: 'var(--text-small)' }}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <p className="mx-auto mt-12 max-w-6xl" style={{ color: '#8E9CC2', fontSize: 'var(--text-micro)' }}>
        A fictional airline in a fictional world.
      </p>

      <img
        className="kx-footer-giant mx-auto max-w-[1400px]"
        src={assetUrl('/brand/v2/kx-wordmark-white.png')}
        alt=""
        aria-hidden
        width={1571}
        height={171}
      />
    </footer>
  )
}
