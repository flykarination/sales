/**
 * Travel updates, loaded from Markdown files in /content/updates.
 *
 * The whole point of this module is that publishing a post requires no code
 * change: drop a .md file in that folder on GitHub, commit, and the deploy
 * picks it up. So the glob is eager — the posts are part of the build, not
 * fetched at runtime — and everything the list needs comes out of each
 * file's front matter.
 *
 * See content/updates/README.md, which is the instructions the author reads.
 */

const FILES = import.meta.glob('/content/updates/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

export type UpdateCategory = 'disruption' | 'advisory' | 'network' | 'product' | 'policy'

export interface TravelUpdate {
  slug: string
  title: string
  date: string
  category: UpdateCategory
  summary: string
  airports: string[]
  /** Last day this is current. Absent means it does not expire. */
  until: string | null
  /** Markdown body, front matter stripped. */
  body: string
}

export const CATEGORY_STYLE: Record<UpdateCategory, { label: string; hue: string; ink: string }> = {
  disruption: { label: 'Disruption', hue: 'var(--color-spectrum-rose)', ink: 'var(--color-spectrum-rose-ink)' },
  advisory: { label: 'Advisory', hue: 'var(--color-spectrum-amber)', ink: 'var(--color-spectrum-amber-ink)' },
  network: { label: 'Network', hue: 'var(--color-spectrum-teal)', ink: 'var(--color-spectrum-teal-ink)' },
  product: { label: 'On board', hue: 'var(--color-spectrum-violet)', ink: 'var(--color-spectrum-violet-ink)' },
  policy: { label: 'Policy', hue: 'var(--color-spectrum-lime)', ink: 'var(--color-spectrum-lime-ink)' },
}

const CATEGORIES = Object.keys(CATEGORY_STYLE) as UpdateCategory[]

/**
 * Front matter, parsed for the handful of shapes the README actually asks
 * for: `key: value`, and comma-separated lists. Deliberately not a YAML
 * parser — a post that needs YAML is a post that needs a different feature.
 */
function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw.trim())
  if (!match) return { meta: {}, body: raw.trim() }

  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 1) continue
    const key = line.slice(0, at).trim().toLowerCase()
    let value = line.slice(at + 1).trim()
    // tolerate quoted values and the [a, b] list form
    value = value.replace(/^["']|["']$/g, '').replace(/^\[|\]$/g, '')
    meta[key] = value
  }
  return { meta, body: match[2].trim() }
}

/** `/content/updates/2026-09-02-typhoon-advisory.md` → `typhoon-advisory`. */
function slugFrom(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.md$/i, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
}

/** First paragraph of the body, for a post that gave no summary. */
function firstParagraph(body: string): string {
  const para = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('|'))
  return (para ?? '').replace(/[*_`[\]]|\(https?:[^)]*\)/g, '').trim()
}

function isCategory(v: string): v is UpdateCategory {
  return (CATEGORIES as string[]).includes(v)
}

export const UPDATES: TravelUpdate[] = Object.entries(FILES)
  .filter(([path]) => !/\/README\.md$/i.test(path))
  .map(([path, raw]) => {
    const { meta, body } = parseFrontMatter(raw)
    const category = (meta.category ?? '').toLowerCase()
    return {
      slug: slugFrom(path),
      title: meta.title || slugFrom(path).replace(/-/g, ' '),
      date: meta.date || '',
      category: isCategory(category) ? category : 'advisory',
      summary: meta.summary || firstParagraph(body),
      airports: (meta.airports || '')
        .split(',')
        .map((a) => a.trim().toUpperCase())
        .filter((a) => /^[A-Z]{3}$/.test(a)),
      until: meta.until || null,
      body,
    }
  })
  // Current posts first, then by date, newest first. An expired post is not
  // hidden — a traveller may still be looking for what happened last week —
  // it just stops competing with what is happening now.
  .sort((a, b) => {
    const ax = Number(isExpired(a))
    const bx = Number(isExpired(b))
    if (ax !== bx) return ax - bx
    return b.date.localeCompare(a.date)
  })

export function isExpired(u: TravelUpdate, today = new Date()): boolean {
  if (!u.until) return false
  return u.until < today.toISOString().slice(0, 10)
}

export const updateBySlug = new Map(UPDATES.map((u) => [u.slug, u]))
