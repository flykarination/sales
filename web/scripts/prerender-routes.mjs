/**
 * Give every client-side route a real file on GitHub Pages.
 *
 * Pages has no server-side rewrite, so a deep link like /sales/travel-info
 * misses, returns HTTP 404, and only then does 404.html boot the app and route
 * client-side. The page works, but the response status is 404 — which crawlers,
 * link previews and uptime checks all take at face value.
 *
 * Copying the built index.html to <route>/index.html makes each of those a real
 * 200. The SPA still handles navigation once loaded; this only fixes the very
 * first request. 404.html stays as the catch-all for anything not listed here,
 * such as /destinations/HKG.
 *
 * Run automatically after `vite build`.
 */
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const source = join(dist, 'index.html')

/** Static routes. Parameterised ones still fall through to 404.html. */
const ROUTES = [
  'search', 'passengers', 'payment', 'confirmation', 'manage',
  'about', 'about/our-story', 'about/what-we-believe', 'fleet', 'cabins', 'network', 'destinations', 'timetable',
  'rainbowone', 'join', 'signin', 'account',
  'checkin', 'flight-status', 'travel-info', 'partners', 'special-assistance',
  'updates',
  // travel information topics
  'travel-info/travel-documents', 'travel-info/children-and-infants',
  'travel-info/restricted-items', 'travel-info/pets', 'travel-info/health',
  'travel-info/disruption', 'travel-info/baggage-claim',
  'travel-info/connecting-in-vietnam',
]

if (!existsSync(source)) {
  console.error('prerender: dist/index.html not found — run the build first')
  process.exit(1)
}

for (const route of ROUTES) {
  const dir = join(dist, route)
  mkdirSync(dir, { recursive: true })
  copyFileSync(source, join(dir, 'index.html'))
}

console.log(`prerender: ${ROUTES.length} routes now resolve to a real index.html`)
