import { parse, serialize, type SerializeOptions } from 'cookie'

type CookieMutation = {
  name: string
  value: string
  options: SerializeOptions
}

export function toSessionCookieOptions(options: SerializeOptions): SerializeOptions {
  if (options.maxAge === 0) {
    return options
  }

  const nextOptions = { ...options }
  delete nextOptions.maxAge
  delete nextOptions.expires
  return nextOptions
}

export function createBrowserSessionCookieAdapter() {
  return {
    getAll() {
      if (typeof document === 'undefined') return []
      const parsed = parse(document.cookie)

      return Object.entries(parsed).map(([name, value]) => ({
        name,
        value: value ?? '',
      }))
    },
    setAll(cookiesToSet: CookieMutation[]) {
      if (typeof document === 'undefined') return
      cookiesToSet.forEach(({ name, value, options }) => {
        document.cookie = serialize(name, value, toSessionCookieOptions(options))
      })
    },
  }
}
