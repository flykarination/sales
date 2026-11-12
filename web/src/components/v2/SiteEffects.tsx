import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { NightSky } from '@/components/v2/NightSky'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

/**
 * The v2 behaviour that belongs to the site rather than to a page.
 *
 *  * Territory. The booking funnel is day; everywhere else is night. Set
 *    on <html data-territory>, where v2-site.css redefines the theme
 *    variables, so every page turns over without being edited.
 *  * The sky. Fixed behind night pages, so the stars hold still while the
 *    page moves over them.
 *  * A streak of light crosses the screen when you move between pages.
 *  * Sections lift into view as they are scrolled to -- only the ones that
 *    start below the fold, so nothing on screen at load ever blinks.
 *  * Cards glow where the pointer is.
 *
 * Everything that moves stands still under reduced motion.
 */

/** Where people read and type carefully: calmer, and in daylight. Mirrored
 *  by the inline script in index.html, which sets it before the app loads. */
const DAY = ['/search', '/passengers', '/payment', '/confirmation', '/manage', '/checkin']

function territoryOf(pathname: string): 'day' | 'night' {
  return DAY.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? 'day' : 'night'
}

export function SiteEffects() {
  // location.key is 'default' on the page you arrive at and unique for every
  // navigation after it, so the streak needs no state of its own
  const { pathname, key } = useLocation()
  const territory = territoryOf(pathname)
  const reduced = usePrefersReducedMotion()

  // territory on <html>, before the browser paints the new page: set in an
  // ordinary effect, a day page showed night colours for one frame on arrival
  useLayoutEffect(() => {
    document.documentElement.dataset.territory = territory
    // index.html painted a first-load background inline; the stylesheet owns it now
    document.documentElement.style.background = ''
  }, [territory])

  // reveal on scroll, night only
  useEffect(() => {
    if (territory !== 'night' || reduced || !('IntersectionObserver' in window)) return
    const main = document.getElementById('main')
    if (!main) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.setAttribute('data-in', '')
          io.unobserve(e.target)
        }
      }
    }, { rootMargin: '0px 0px -8% 0px' })

    const scan = () => {
      const fold = window.innerHeight
      main.querySelectorAll<HTMLElement>('section, article').forEach((el) => {
        if (el.dataset.revealSeen) return
        el.dataset.revealSeen = '1'
        // already on screen (or the funnel's own content): leave it alone
        if (el.getBoundingClientRect().top < fold * 0.9) return
        if (el.closest('.kx-daylight')) return
        // never gate a form behind an effect: the search box is the page's job
        if (el.querySelector('form, input, select, textarea')) return
        el.setAttribute('data-reveal', '')
        io.observe(el)
      })
    }
    // lazy pages render after this effect; watch for them
    let t = 0
    const mo = new MutationObserver(() => { window.clearTimeout(t); t = window.setTimeout(scan, 60) })
    mo.observe(main, { childList: true, subtree: true })
    scan()
    return () => { io.disconnect(); mo.disconnect(); window.clearTimeout(t) }
  }, [pathname, territory, reduced])

  // pointer glow on cards
  useEffect(() => {
    if (territory !== 'night') return
    let frame = 0
    let last: PointerEvent | null = null
    const paint = () => {
      frame = 0
      if (!last) return
      const card = (last.target as Element | null)?.closest?.('.kx-card, .kx-glow') as HTMLElement | null
      if (!card) return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${last.clientX - r.left}px`)
      card.style.setProperty('--my', `${last.clientY - r.top}px`)
    }
    const onMove = (e: PointerEvent) => { last = e; if (!frame) frame = requestAnimationFrame(paint) }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => { document.removeEventListener('pointermove', onMove); if (frame) cancelAnimationFrame(frame) }
  }, [territory])

  // Rows that carry a coloured label (the small square marking a topic, a
  // cabin, a region or an airline) fade to that label's colour on hover. The
  // colour is read from the marker itself, so every such list on the site
  // does this without being edited -- and stays right if a colour changes.
  useEffect(() => {
    const onOver = (e: PointerEvent) => {
      const row = (e.target as Element | null)?.closest?.('a, button, li, label') as HTMLElement | null
      if (!row || row.dataset.hued !== undefined) return
      const marker = [...row.querySelectorAll<HTMLElement>('span[aria-hidden]')].find((m) => {
        const r = m.getBoundingClientRect()
        const bg = getComputedStyle(m).backgroundColor
        return r.width > 0 && r.width <= 16 && r.height <= 16 && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent'
      })
      // a marker is a label, not a background: ignore rows the size of a card
      if (!marker || row.getBoundingClientRect().height > 160) { row.dataset.hued = ''; return }
      row.style.setProperty('--hue', getComputedStyle(marker).backgroundColor)
      row.dataset.hued = 'yes'
    }
    document.addEventListener('pointerover', onOver, { passive: true })
    return () => document.removeEventListener('pointerover', onOver)
  }, [])

  return (
    <>
      {territory === 'night' && (
        <div className="kx-backdrop" aria-hidden>
          <NightSky />
        </div>
      )}
      {/* the streak, on every navigation after the first page */}
      {!reduced && key !== 'default' && <span key={key} className="kx-warp" aria-hidden />}
    </>
  )
}
