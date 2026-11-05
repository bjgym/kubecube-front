export interface StoredLocation {
  path: string
  query: Record<string, string>
}

export function splitInternalLocation(value: string): StoredLocation {
  const raw = value.startsWith('#') ? value.slice(1) : value
  const [rawPath = '/', rawQuery = ''] = raw.split('?', 2)
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const query = Object.fromEntries(new URLSearchParams(rawQuery).entries())
  return { path: path || '/', query }
}

export function locationFromHash(hash: string): StoredLocation {
  if (!hash) return { path: '/', query: {} }
  return splitInternalLocation(hash)
}

export function isAuthLocation(location: StoredLocation): boolean {
  return location.path === '/login' || location.path.startsWith('/login/')
}
