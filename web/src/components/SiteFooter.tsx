import { Link } from 'react-router-dom'
import { assetUrl } from '@/lib/assets'

export function SiteFooter() {
  return (
    <footer className="on-ink px-5 py-12 md:px-8" style={{ background: 'var(--color-ink)' }}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-6">
        <img src={assetUrl('/brand/wordmark-light.png')} alt="Karination" style={{ height: 20, width: 'auto' }} />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {[['/about', 'About us'], ['/cabins', 'On board'], ['/fleet', 'Our fleet'], ['/destinations', 'Destinations'], ['/network', 'Route map'], ['/timetable', 'Timetable'], ['/travel-info', 'Travel information'], ['/updates', 'Travel updates'], ['/special-assistance', 'Special assistance'], ['/partners', 'Partners'], ['/rainbowone', 'RainbowOne'], ['/checkin', 'Check in'], ['/manage', 'Manage booking']].map(
              ([to, label]) => (
                <li key={to}>
                  <Link to={to} style={{ color: '#B9B6D8', fontSize: 'var(--text-small)' }}>{label}</Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <img src={assetUrl('/brand/echo-aegis.png')} alt="" style={{ height: 22, width: 'auto', borderRadius: 5 }} />
          <span style={{ color: '#8F8CB4', fontSize: 'var(--text-micro)' }}>KX · A member of Echo Aegis</span>
        </div>
        <p className="ml-auto" style={{ color: '#6B6790', fontSize: 'var(--text-micro)' }}>
          A fictional airline in a fictional world.
        </p>
      </div>
    </footer>
  )
}
