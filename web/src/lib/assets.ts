/**
 * Resolves static asset paths relative to the application's base URL.
 * Handles cases where Vite base is set (e.g. /sales/ on GitHub Pages).
 */
export function assetUrl(path: string | null | undefined): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}
