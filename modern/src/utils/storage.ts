export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* storage can be unavailable */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* storage can be unavailable */
    }
  },
  getJSON<T>(key: string): T | null {
    const value = this.get(key)
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  },
  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value))
  },
}
