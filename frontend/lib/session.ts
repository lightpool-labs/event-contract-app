const TOKEN_KEY = "lightpool.sessionToken";
const ADDRESS_KEY = "lightpool.sessionAddress";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getSessionAddress(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ADDRESS_KEY);
}

export function setSession(token: string, address: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(ADDRESS_KEY, address);
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ADDRESS_KEY);
}

export const SESSION_CHANGED_EVENT = "lightpool:session-changed";

export function notifySessionChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  }
}
