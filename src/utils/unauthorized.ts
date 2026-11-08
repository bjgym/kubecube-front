export function createUnauthorizedGate(windowMs = 1000): (now?: number) => boolean {
  let lastHandled = 0
  return (now = Date.now()) => {
    if (lastHandled && now - lastHandled < windowMs) return false
    lastHandled = now
    return true
  }
}
