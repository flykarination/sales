import { NightSky } from '@/components/v2/NightSky'
import { DotMatrix, FluoroText } from '@/components/v2/Type'
import { CABIN_ORDER, CABINS, REGION_STYLE, type RegionKey } from '@/lib/cabins'
import { CARRIERS } from '@/data/carriers'
import { assetUrl } from '@/lib/assets'

/**
 * The v2 system on one page, for judging it as a system rather than through
 * one hero: the canvases, the meaning-colours, the type scale, the
 * wordmarks and the buttons. Not in the menu; reached at /brand.
 */

const NIGHT: Array<[string, string, string]> = [
  ['Night', '--color-night', 'The livery backdrop. The canvas outside the funnel.'],
  ['Night deep', '--color-night-deep', 'The top of the sky.'],
  ['Night glow', '--color-night-glow', 'Where the sky lightens.'],
  ['Starlight', '--color-starlight', 'Text on the night. 15:1.'],
  ['Starlight mute', '--color-starlight-mute', 'Secondary text on the night. 9.6:1.'],
  ['Ultramarine', '--color-ultramarine', 'The wordmark’s first letter.'],
  ['Signal', '--color-signal', 'The wordmark’s last letter.'],
  ['FORZA night', '--color-forza-night', 'FORZA’s purple-black universe.'],
]

export default function Brand() {
  return (
    <div>
      <section className="kx-night px-5 pb-20 pt-14 md:px-10">
        <NightSky />
        <div className="mx-auto max-w-6xl">
          <DotMatrix>Karination · v2 system</DotMatrix>
          <h1 className="kx-mega mt-4">Kinetic <FluoroText>light</FluoroText></h1>
          <p className="mt-6" style={{ color: 'var(--color-starlight-mute)', maxWidth: '58ch', fontSize: 'var(--text-lead)' }}>
            Night outside, day at checkout, and colour that still means something:
            a cabin or a region is always a solid colour on a solid surface,
            never a hue in the aurora.
          </p>

          <Heading>Wordmark</Heading>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="kx-glass flex items-center justify-center p-10">
              <img src={assetUrl('/brand/v2/kx-wordmark-white.png')} alt="Karination wordmark in white" style={{ width: '100%', maxWidth: 420 }} />
            </div>
            <div className="flex items-center justify-center rounded-2xl p-10" style={{ background: 'var(--color-paper)' }}>
              <img src={assetUrl('/brand/v2/kx-wordmark.png')} alt="Karination wordmark in its ultramarine-to-red gradient" style={{ width: '100%', maxWidth: 420 }} />
            </div>
          </div>
          <Note>White on the night; the gradient on the day. On navy the gradient&rsquo;s ultramarine end measures 1.0:1 and the K disappears.</Note>

          <Heading>The night palette</Heading>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {NIGHT.map(([name, token, note]) => (
              <li key={token}>
                <span className="block rounded-xl" style={{ height: 72, background: `var(${token})`, boxShadow: '0 0 0 1px rgba(244,247,255,0.16)' }} />
                <span className="mt-2 block" style={{ fontWeight: 600 }}>{name}</span>
                <span className="block font-mono" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-starlight-mute)' }}>{token}</span>
                <span className="block" style={{ fontSize: 'var(--text-small)', color: 'var(--color-starlight-mute)' }}>{note}</span>
              </li>
            ))}
          </ul>

          <Heading>The fluoro</Heading>
          <div className="overflow-hidden rounded-2xl" style={{ height: 120, background: `url(${assetUrl('/v2/fluoro.webp')}) center / cover` }} />
          <div className="mt-3 rounded-full" style={{ height: 10, background: 'var(--paint-fluoro)' }} />
          <Note>The image is the light source. The gradient below it is sampled from its centre line, for edges, rings and progress lines where the image cannot go.</Note>

          <Heading>Type</Heading>
          <div className="space-y-6">
            <p className="kx-mega">Hà Nội <FluoroText>Lima</FluoroText></p>
            <p className="kx-headline">Nonstop, Nha Trang to Santiago</p>
            <p style={{ fontSize: 'var(--text-lead)', maxWidth: '60ch', color: 'var(--color-starlight-mute)' }}>
              Body text stays Be Vietnam Pro: drawn for Vietnamese, calm at length. Headlines are Mona Sans, weight 820 at its widest, 125%,
              set tight in capitals &mdash; with a full Vietnamese subset, so the marks on HÀ NỘI and ĐÀ NẴNG are the face&rsquo;s own.
            </p>
            <p className="tnum font-mono" style={{ fontSize: '1.6rem' }}>KX 5281 · 18:00 → 00:00<sup>+1</sup> · 17h</p>
            <p><DotMatrix size="1.4rem">Boarding · gate 12</DotMatrix></p>
          </div>

          <Heading>Buttons on the night</Heading>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="kx-cta-night">Find a flight</button>
            <button type="button" className="kx-cta-ghost">The route map</button>
          </div>
        </div>
        <div aria-hidden style={{ height: 120 }} />
      </section>

      <section className="px-4 md:px-8" style={{ marginTop: -110 }}>
        <div className="kx-dayfall mx-auto max-w-6xl px-6 pb-12 pt-10 md:px-10">
          <h2 className="kx-headline" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.6rem)' }}>The day: where colour means something</h2>
          <p className="mt-3" style={{ color: 'var(--color-ink-mute)', maxWidth: '62ch' }}>
            Checkout, results and timetables. The fluoro carries on as an edge light; every hue below is a fact about a cabin, a region or an airline.
          </p>

          <DayHeading>Cabins</DayHeading>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {CABIN_ORDER.map((code) => {
              const c = CABINS[code]
              return (
                <li key={code} style={{ borderTop: `4px solid ${c.hue}`, background: c.wash, padding: '14px 14px 16px' }}>
                  <span style={{ fontWeight: 600, color: c.ink }}>{c.longName}</span>
                  {code === 'BUSINESS' && <Changed>was violet; now the wordmark&rsquo;s ultramarine</Changed>}
                </li>
              )
            })}
          </ul>

          <DayHeading>Regions on the route map</DayHeading>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {(Object.keys(REGION_STYLE) as RegionKey[]).map((k) => {
              const r = REGION_STYLE[k]
              return (
                <li key={k} className="flex items-start gap-3">
                  <span aria-hidden className="mt-1 flex-none rounded" style={{ width: 28, height: 4, background: r.hue }} />
                  <span>
                    <span style={{ fontWeight: 600, color: r.ink }}>{r.label}</span>
                    {k === 'EUROPE' && <Changed>was violet; now coral</Changed>}
                  </span>
                </li>
              )
            })}
          </ul>

          <DayHeading>The group</DayHeading>
          <ul className="grid gap-4 md:grid-cols-3">
            {CARRIERS.map((c) => (
              <li key={c.code} className="flex items-center gap-3" style={{ borderLeft: `4px solid ${c.accent}`, paddingLeft: 12 }}>
                <span>
                  <span style={{ fontWeight: 600, color: c.accentInk }}>{c.name}</span>
                  <span className="block" style={{ fontSize: 'var(--text-small)', color: 'var(--color-ink-mute)' }}>
                    {c.code === 'Z4' ? 'Purple, on a purple-black universe of triangles' : c.code === 'SD' ? 'Pink, with audio waveforms (to come)' : 'Teal on the day, light on the night'}
                  </span>
                  {c.code === 'Z4' && <Changed>was amber; amber stays Premium Economy</Changed>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div style={{ height: 60 }} />
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="kx-eyebrow mb-4 mt-16" style={{ color: 'var(--color-starlight-mute)' }}>{children}</h2>
}
function DayHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="kx-eyebrow mb-4 mt-10" style={{ color: 'var(--color-ink-mute)' }}>{children}</h3>
}
function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3" style={{ fontSize: 'var(--text-small)', color: 'var(--color-starlight-mute)', maxWidth: '70ch' }}>{children}</p>
}
function Changed({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block font-mono" style={{ fontSize: 'var(--text-micro)', color: 'var(--color-ink-mute)' }}>{children}</span>
}
