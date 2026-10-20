import type {
  AuthSessionDto,
  DeviceSessionDto,
  LoginInput,
  SignupInput,
  UserDto,
} from '@livelog/shared';
import type { Config } from '../../config/env';
import type { UserRow } from '../../db/schema';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from '../../lib/crypto';
import { iso } from '../../lib/dates';
import { Errors } from '../../lib/errors';
import type { ClientMeta } from '../../lib/http';
import type { AccessTokens, AuthUser } from '../../lib/tokens';
import type { Repositories } from '../repositories';
import { toUserDto } from '../users/user.mapper';

/** A refresh token presented again within this window is a benign race, not theft. */
const REUSE_GRACE_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IssuedSession {
  session: AuthSessionDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export class AuthService {
  constructor(
    private readonly deps: {
      repos: Repositories;
      tokens: AccessTokens;
      config: Config['auth'];
    },
  ) {}

  async signup(input: SignupInput, meta: ClientMeta): Promise<IssuedSession> {
    const { users } = this.deps.repos;
    if (await users.findByEmail(input.email)) {
      throw Errors.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    const user = await users.create({
      email: input.email,
      displayName: input.displayName,
      role: this.deps.config.adminEmails.includes(input.email) ? 'admin' : 'reader',
      passwordHash: await hashPassword(input.password),
    });
    return this.startSession(user, meta);
  }

  async login(input: LoginInput, meta: ClientMeta): Promise<IssuedSession> {
    const { users } = this.deps.repos;
    const user = await users.findByEmail(input.email);
    // Always run the hash so response time does not reveal whether the email exists.
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) {
      throw Errors.unauthenticated('That email and password do not match', 'INVALID_CREDENTIALS');
    }
    await users.touchLogin(user.id);
    return this.startSession(user, meta);
  }

  async refresh(rawToken: string | undefined, meta: ClientMeta): Promise<IssuedSession> {
    if (!rawToken) throw Errors.unauthenticated('No active session', 'NO_SESSION');
    const { sessions, users } = this.deps.repos;
    const presentedHash = sha256(rawToken);
    const session = await sessions.findByTokenHash(presentedHash);

    if (!session) {
      const rotated = await sessions.findByPreviousTokenHash(presentedHash);
      if (rotated && !rotated.revokedAt) {
        const age = Date.now() - (rotated.rotatedAt?.getTime() ?? 0);
        if (age < REUSE_GRACE_MS) {
          throw Errors.unauthenticated('Session was refreshed in another tab', 'REFRESH_STALE');
        }
        // An old token came back long after rotation: treat as stolen and end the session.
        await sessions.revoke(rotated.id);
      }
      throw Errors.unauthenticated(
        'Your session has ended, please sign in again',
        'SESSION_EXPIRED',
      );
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw Errors.unauthenticated(
        'Your session has ended, please sign in again',
        'SESSION_EXPIRED',
      );
    }

    const user = await users.findById(session.userId);
    if (!user) throw Errors.unauthenticated('Account no longer exists', 'SESSION_EXPIRED');

    const refreshToken = randomToken(48);
    const refreshExpiresAt = this.refreshExpiry();
    const rotated = await sessions.rotate(session.id, presentedHash, {
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiresAt,
      ...meta,
    });
    if (!rotated)
      throw Errors.unauthenticated('Session was refreshed in another tab', 'REFRESH_STALE');

    return {
      session: await this.issueAccess(user, session.id),
      refreshToken,
      refreshExpiresAt,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const session = await this.deps.repos.sessions.findByTokenHash(sha256(rawToken));
    if (session) await this.deps.repos.sessions.revoke(session.id);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.deps.repos.users.findById(userId);
    if (!user) throw Errors.unauthenticated('Account no longer exists', 'SESSION_EXPIRED');
    return toUserDto(user);
  }

  async listSessions(auth: AuthUser): Promise<DeviceSessionDto[]> {
    const rows = await this.deps.repos.sessions.listActive(auth.id);
    return rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ip: row.ip,
      createdAt: iso(row.createdAt),
      lastUsedAt: iso(row.lastUsedAt),
      current: row.id === auth.sessionId,
    }));
  }

  async revokeSession(auth: AuthUser, sessionId: string): Promise<void> {
    const session = await this.deps.repos.sessions.findById(sessionId);
    if (!session || session.userId !== auth.id) throw Errors.notFound('Session');
    await this.deps.repos.sessions.revoke(session.id);
  }

  private async startSession(user: UserRow, meta: ClientMeta): Promise<IssuedSession> {
    const refreshToken = randomToken(48);
    const refreshExpiresAt = this.refreshExpiry();
    const session = await this.deps.repos.sessions.create({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { session: await this.issueAccess(user, session.id), refreshToken, refreshExpiresAt };
  }

  private async issueAccess(user: UserRow, sessionId: string): Promise<AuthSessionDto> {
    const access = await this.deps.tokens.issue({ id: user.id, role: user.role, sessionId });
    return {
      user: toUserDto(user),
      accessToken: access.token,
      accessTokenExpiresAt: iso(access.expiresAt),
    };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.deps.config.refreshTtlDays * DAY_MS);
  }
}
