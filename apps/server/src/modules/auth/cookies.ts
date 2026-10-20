import type { Response } from 'express';

/** httpOnly refresh token, only ever sent to /api/auth/*. */
export const REFRESH_COOKIE = 'll_rt';
/** Readable hint so the SPA can skip the refresh round-trip for anonymous visitors. */
export const SESSION_HINT_COOKIE = 'll_session';

const REFRESH_PATH = '/api/auth';

export function setSessionCookies(res: Response, token: string, expiresAt: Date, secure: boolean) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_PATH,
    expires: expiresAt,
  });
  res.cookie(SESSION_HINT_COOKIE, '1', {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookies(res: Response, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: REFRESH_PATH,
  });
  res.clearCookie(SESSION_HINT_COOKIE, { secure, sameSite: 'strict', path: '/' });
}
