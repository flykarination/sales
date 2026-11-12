/**
 * The group's other two universes, as decoration for wherever FORZA and
 * Sonder appear: FORZA's purple-black field of triangles is a CSS class
 * (.kx-forza-universe); Sonder's audio waveform is this component -- bars
 * moving like an equaliser, each on its own tempo. Decorative, aria-hidden,
 * still under reduced motion.
 */
const BARS = Array.from({ length: 28 }, (_, i) => ({
  // fixed pseudo-random tempos so the wave is the same on every visit
  d: `${0.7 + ((i * 37) % 11) / 10}s`,
  delay: `-${((i * 53) % 17) / 10}s`,
}))

export function SonderWave({ bars = 28, height = 34 }: { bars?: number; height?: number }) {
  return (
    <span className="kx-sonder-wave" aria-hidden style={{ height }}>
      {BARS.slice(0, bars).map((b, i) => (
        <span key={i} style={{ ['--d' as string]: b.d, ['--delay' as string]: b.delay }} />
      ))}
    </span>
  )
}
