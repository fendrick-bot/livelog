import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';
import type { Role } from '@livelog/shared';
import { Errors } from './errors';

/** The authenticated principal attached to requests and sockets. */
export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
}

const ISSUER = 'livelog';
const AUDIENCE = 'livelog-web';

export class AccessTokens {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(user: AuthUser): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const token = await new SignJWT({ role: user.role, sid: user.sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { token, expiresAt };
  }

  /** Throws AppError(401, TOKEN_EXPIRED | TOKEN_INVALID). */
  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      const role = payload.role;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        (role !== 'admin' && role !== 'reader')
      ) {
        throw Errors.unauthenticated('Malformed access token', 'TOKEN_INVALID');
      }
      return { id: payload.sub, role, sessionId: payload.sid };
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        throw Errors.unauthenticated('Your session needs a refresh', 'TOKEN_EXPIRED');
      }
      if (error instanceof joseErrors.JOSEError) {
        throw Errors.unauthenticated('Invalid access token', 'TOKEN_INVALID');
      }
      throw error;
    }
  }
}
