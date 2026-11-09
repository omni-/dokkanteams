// localStorage can be missing or throw (private windows, blocked site data), so every access is guarded.
const PREFIX = 'dokkan-builder:';

export function loadSaved<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

export function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Saving is a convenience; the page works without it.
  }
}
