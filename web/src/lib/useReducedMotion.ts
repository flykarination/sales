import { useSyncExternalStore } from 'react'

/**
 * True when the visitor has asked for reduced motion, kept live if they
 * change the setting while the page is open.
 *
 * The home page's own copy rather than motion's: importing anything that
 * renders a `motion.*` element pulls the library's whole animation engine
 * into the first-load bundle (+136 kB measured), for what is one media query.
 */
const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
