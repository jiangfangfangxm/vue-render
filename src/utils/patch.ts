export function applyPatch<T>(state: T, patcher: (s: T) => T): T {
  return patcher(state)
}
