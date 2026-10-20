import type { ApiErrorBody, AuthSessionDto, UserDto } from '@livelog/shared';
import { useSyncExternalStore } from 'react';

/**
 * Session handling
 * - The access token lives only in memory (never in localStorage).
 * - The refresh token is an httpOnly cookie the browser sends to /api/auth/*.
 * - Refreshes are single-flight within a tab and serialised across tabs with
 *   the Web Locks API, so rotating refresh tokens never race each other.
 * - Tokens are refreshed proactively a minute before they expire, and again
 *   when a sleeping tab becomes visible, so requests rarely see a 401.
 */
export interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous';
  user: UserDto | null;
  accessToken: string | null;
  expiresAt: number | null;
}

let state: AuthState = { status: 'loading', user: null, accessToken: null, expiresAt: null };
const listeners = new Set<() => void>();

export const authStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set(next: AuthState) {
    state = next;
    for (const listener of listeners) listener();
  },
};

export function useAuth(): AuthState {
  return useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
}

let resolveReady: () => void;
/** Resolves once the initial session check has finished (either way). */
export const authReady = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function applySession(session: AuthSessionDto): void {
  const expiresAt = new Date(session.accessTokenExpiresAt).getTime();
  authStore.set({
    status: 'authenticated',
    user: session.user,
    accessToken: session.accessToken,
    expiresAt,
  });
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(5_000, expiresAt - Date.now() - 60_000);
  refreshTimer = setTimeout(() => void refreshSession(), delay);
}

export function clearSession(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  authStore.set({ status: 'anonymous', user: null, accessToken: null, expiresAt: null });
}

export function updateUser(user: UserDto): void {
  if (state.status === 'authenticated') authStore.set({ ...state, user });
}

const hasSessionHint = () => document.cookie.split('; ').some((part) => part === 'll_session=1');

async function callRefresh(attempt = 0): Promise<boolean> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (res.ok) {
    const body = (await res.json()) as { data: AuthSessionDto };
    applySession(body.data);
    return true;
  }
  const error = (await res.json().catch(() => null)) as { error?: ApiErrorBody } | null;
  // Another tab rotated the token a moment ago; the cookie jar now holds the new one.
  if (error?.error?.code === 'REFRESH_STALE' && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    return callRefresh(attempt + 1);
  }
  if (res.status === 401 || res.status === 403) {
    clearSession();
    return false;
  }
  throw new Error(error?.error?.message ?? 'Could not refresh your session');
}

let inflight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  inflight ??= (async () => {
    try {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      return locks
        ? await locks.request('livelog-refresh', () => callRefresh())
        : await callRefresh();
    } catch {
      // Network trouble: keep whatever state we had; the next request will try again.
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Called once at startup. Anonymous visitors skip the network entirely. */
export async function bootstrapAuth(): Promise<void> {
  try {
    if (!hasSessionHint()) clearSession();
    else if (!(await refreshSession()) && authStore.get().status === 'loading') clearSession();
  } finally {
    resolveReady();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const { status, expiresAt } = authStore.get();
    if (document.visibilityState === 'visible' && status === 'authenticated' && expiresAt) {
      if (expiresAt - Date.now() < 90_000) void refreshSession();
    }
  });
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    clearSession();
  }
}
