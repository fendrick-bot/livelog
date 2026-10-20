import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((value) =>
      value === undefined || value === '' ? fallback : value === 'true' || value === '1',
    );

const csv = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(4000),
    PUBLIC_URL: z.url().default('http://localhost:5173'),
    CORS_ORIGINS: csv,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_DRIVER: z.enum(['pg', 'pglite']).default('pg'),
    DATABASE_URL: z.string().optional(),
    PGLITE_DATA_DIR: z.string().default('.pglite'),
    AUTO_MIGRATE: bool(false),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
    ADMIN_EMAILS: csv,
    COOKIE_SECURE: bool(false).optional(),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: bool(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default('Livelog <diary@livelog.local>'),
    OUTBOX_POLL_MS: z.coerce.number().int().min(250).default(5000),

    SERVE_WEB: bool(false),
    WEB_DIST_DIR: z.string().optional(),
    TRUST_PROXY: bool(false),
    RATE_LIMIT_ENABLED: bool(true),
  })
  .superRefine((env, ctx) => {
    if (env.DATABASE_DRIVER === 'pg' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when DATABASE_DRIVER=pg',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface Config {
  env: Env['NODE_ENV'];
  isProd: boolean;
  isTest: boolean;
  host: string;
  port: number;
  publicUrl: string;
  corsOrigins: string[];
  logLevel: Env['LOG_LEVEL'];
  db: {
    driver: Env['DATABASE_DRIVER'];
    url: string | undefined;
    pgliteDir: string;
    autoMigrate: boolean;
  };
  auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
    adminEmails: string[];
    cookieSecure: boolean;
  };
  mail: {
    from: string;
    smtp: { host: string; port: number; secure: boolean; user?: string; pass?: string } | null;
    pollMs: number;
  };
  web: { serve: boolean; distDir: string };
  trustProxy: boolean;
  rateLimitEnabled: boolean;
}

/** Loads the nearest .env (server dir first, then the monorepo root). Real env vars win. */
export function loadDotEnv(cwd = process.cwd()): void {
  for (const candidate of [resolve(cwd, '.env'), resolve(cwd, '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';
  const publicUrl = env.PUBLIC_URL.replace(/\/+$/, '');

  return {
    env: env.NODE_ENV,
    isProd,
    isTest: env.NODE_ENV === 'test',
    host: env.HOST,
    port: env.PORT,
    publicUrl,
    corsOrigins: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : [publicUrl],
    logLevel: env.LOG_LEVEL,
    db: {
      driver: env.DATABASE_DRIVER,
      url: env.DATABASE_URL,
      pgliteDir: env.PGLITE_DATA_DIR,
      autoMigrate: env.AUTO_MIGRATE || env.DATABASE_DRIVER === 'pglite',
    },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      adminEmails: env.ADMIN_EMAILS.map((email) => email.toLowerCase()),
      cookieSecure: env.COOKIE_SECURE ?? isProd,
    },
    mail: {
      from: env.MAIL_FROM,
      smtp: env.SMTP_HOST
        ? {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            user: env.SMTP_USER || undefined,
            pass: env.SMTP_PASS || undefined,
          }
        : null,
      pollMs: env.OUTBOX_POLL_MS,
    },
    web: {
      serve: env.SERVE_WEB,
      distDir: env.WEB_DIST_DIR ?? resolve(process.cwd(), '../web/dist'),
    },
    trustProxy: env.TRUST_PROXY,
    rateLimitEnabled: env.RATE_LIMIT_ENABLED && env.NODE_ENV !== 'test',
  };
}
