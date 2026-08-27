import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const hasCredentials = Boolean(url && key)

const MISSING = {
  message:
    'No Supabase credentials. Paste your publishable key into web/.env.local ' +
    '(VITE_SUPABASE_PUBLISHABLE_KEY) and restart the dev server.',
  code: 'NO_CREDENTIALS',
}

/**
 * `createClient` throws synchronously on an empty key, which would take the
 * whole app down at import time and leave a blank page. The site is meant to
 * still render — with the hub-only airport fallback and a visible notice — so
 * when the key is absent we hand back a stand-in that answers every call with
 * `{ data: null, error }` instead of exploding.
 *
 * Every method chains onto itself and the result is awaitable, which covers
 * both the `.from().select().order()` builder style and a bare `.rpc()`.
 */
function offlineClient(): SupabaseClient {
  const result = { data: null, error: MISSING }
  const handler: ProxyHandler<() => void> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (resolve: (v: typeof result) => unknown) => Promise.resolve(resolve(result))
      }
      if (prop === Symbol.toPrimitive || prop === 'toJSON') return () => '[offline supabase]'
      return () => proxy
    },
    apply() {
      return proxy
    },
  }
  const proxy = new Proxy(function () {} as () => void, handler)
  return proxy as unknown as SupabaseClient
}

if (!hasCredentials) {
  console.warn(
    '[karination] ' + MISSING.message + '\nThe site will render with the five hubs only.',
  )
}

export const supabase: SupabaseClient = hasCredentials
  ? createClient(url as string, key as string, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : offlineClient()

/**
 * The operator dashboard is compiled out of production builds, and the data
 * behind it is not readable with the publishable key. In dev the token comes
 * from .env.local, which is gitignored and never bundled for production.
 */
export const opsToken = import.meta.env.DEV
  ? ((import.meta.env.VITE_OPS_TOKEN as string | undefined) ?? '')
  : ''

export const opsAvailable = import.meta.env.DEV && opsToken.length > 0
