/**
 * Star fields for the v2 night sky, as box-shadow lists: hundreds of stars
 * drawn by one element. Seeded, so the sky is identical on every visit.
 */

/** A small seeded generator (LCG); deterministic, not random. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** One layer of stars as a single box-shadow: hundreds of dots, one element. */
export function starField(seed: number, count: number, opts: { maxY: number; sizes: number[]; alpha: [number, number] }) {
  const r = rng(seed)
  const dots: string[] = []
  for (let i = 0; i < count; i += 1) {
    const x = (r() * 100).toFixed(2)
    // denser towards the top of the sky, as a long exposure shows it
    const y = Math.round(Math.pow(r(), 1.35) * opts.maxY)
    const size = opts.sizes[Math.floor(r() * opts.sizes.length)]
    const a = (opts.alpha[0] + r() * (opts.alpha[1] - opts.alpha[0])).toFixed(2)
    dots.push(`${x}vw ${y}px 0 ${size}px rgba(244,247,255,${a})`)
  }
  return dots.join(',')
}
