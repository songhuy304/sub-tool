const ADMIN_KEY_STORAGE = 'locket_admin_api_key';

export function getAdminApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setAdminApiKey(key: string): void {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
}

export function clearAdminApiKey(): void {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

export function hasAdminApiKey(): boolean {
  return Boolean(getAdminApiKey());
}
