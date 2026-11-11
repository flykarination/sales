import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { BookingProvider } from '@/booking/BookingContext'
import { AuthProvider } from '@/auth/AuthContext'
import Home from '@/pages/Home'

const Results = lazy(() => import('@/pages/Results'))
const Brand = lazy(() => import('@/pages/Brand'))
const Passengers = lazy(() => import('@/pages/Passengers'))
const Payment = lazy(() => import('@/pages/Payment'))
const Confirmation = lazy(() => import('@/pages/Confirmation'))
const Manage = lazy(() => import('@/pages/Manage'))
const About = lazy(() => import('@/pages/About'))
const OurStory = lazy(() => import('@/pages/OurStory'))
const WhatWeBelieve = lazy(() => import('@/pages/WhatWeBelieve'))
const Fleet = lazy(() => import('@/pages/Fleet'))
const Network = lazy(() => import('@/pages/Network'))
const Destinations = lazy(() => import('@/pages/Destinations'))
const Timetable = lazy(() => import('@/pages/Timetable'))
const RainbowOne = lazy(() => import('@/pages/RainbowOne'))
const Join = lazy(() => import('@/pages/Join'))
const SignIn = lazy(() => import('@/pages/SignIn'))
const Account = lazy(() => import('@/pages/Account'))
const CheckIn = lazy(() => import('@/pages/CheckIn'))
const FlightStatus = lazy(() => import('@/pages/FlightStatus'))
const DestinationGuide = lazy(() => import('@/pages/DestinationGuide'))
const TravelInfo = lazy(() => import('@/pages/TravelInfo'))
const Updates = lazy(() => import('@/pages/Updates'))
const Partners = lazy(() => import('@/pages/Partners'))
const SpecialAssistance = lazy(() => import('@/pages/SpecialAssistance'))
const TravelTopic = lazy(() => import('@/pages/TravelTopic'))
const Cabins = lazy(() => import('@/pages/Cabins'))

/**
 * The operator dashboard is compiled out of production builds entirely.
 * `import.meta.env.DEV` is statically replaced at build time, so Rollup drops
 * both the branch and the chunk — the route does not exist in what ships.
 */
const Ops = import.meta.env.DEV ? lazy(() => import('@/pages/Ops')) : null

/** Focus and scroll must move on navigation, or the page silently changes. */
function RouteChange() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    // a #anchor link should land on its section, not the top of the page
    if (hash) {
      const el = document.querySelector(hash)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    }
    window.scrollTo(0, 0)
    const h = document.querySelector('h1')
    if (h) {
      h.setAttribute('tabindex', '-1')
      ;(h as HTMLElement).focus({ preventScroll: true })
    }
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
      <BookingProvider>
        <RouteChange />
        <a href="#main" className="kx-skip">Skip to content</a>
        <SiteHeader />
        <main id="main">
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/brand" element={<Brand />} />
              <Route path="/search" element={<Results />} />
              <Route path="/passengers" element={<Passengers />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/confirmation" element={<Confirmation />} />
              <Route path="/manage" element={<Manage />} />
              <Route path="/about" element={<About />} />
              <Route path="/about/our-story" element={<OurStory />} />
              <Route path="/about/what-we-believe" element={<WhatWeBelieve />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/cabins" element={<Cabins />} />
              <Route path="/network" element={<Network />} />
              <Route path="/destinations" element={<Destinations />} />
              <Route path="/destinations/:iata" element={<DestinationGuide />} />
              <Route path="/checkin" element={<CheckIn />} />
              <Route path="/flight-status" element={<FlightStatus />} />
              <Route path="/travel-info" element={<TravelInfo />} />
              <Route path="/updates" element={<Updates />} />
              <Route path="/updates/:slug" element={<Updates />} />
              <Route path="/special-assistance" element={<SpecialAssistance />} />
              <Route path="/travel-info/:slug" element={<TravelTopic />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/rainbowone" element={<RainbowOne />} />
              <Route path="/join" element={<Join />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/account" element={<Account />} />
              {Ops && <Route path="/ops" element={<Ops />} />}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <SiteFooter />
      </BookingProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

function PageLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 md:px-8" aria-busy="true">
      <div className="animate-pulse" style={{ height: 28, width: 220, background: 'var(--color-paper-sunk)' }} />
      <div className="mt-6 animate-pulse" style={{ height: 220, background: 'var(--color-paper-sunk)', opacity: 0.6 }} />
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20 md:px-8">
      <h1 className="font-display" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>
        That page isn't on our network.
      </h1>
      <p className="mt-3" style={{ color: 'var(--color-ink-mute)' }}>
        Try searching for a flight from the home page instead.
      </p>
    </div>
  )
}
