import type { Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';
import { Errors } from './errors';
import type { AuthUser } from './tokens';

/**
 * Declarative, fully typed route handlers.
 *
 *   router.post('/', route({ auth: 'user', body: createCommentInput }, async ({ body, auth }) => ({
 *     status: 201,
 *     data: await comments.create(auth, body),
 *   })));
 *
 * - validates params → query → body with the shared zod schemas
 * - enforces the auth mode before the handler runs (and narrows `auth`'s type)
 * - wraps the returned data in the `{ data }` envelope (204 when there is none)
 */
export type AuthMode = 'public' | 'user' | 'admin';

export interface RouteSpec {
  auth?: AuthMode;
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
}

type Parsed<T> = T extends ZodType ? z.output<T> : undefined;

export interface RouteContext<S extends RouteSpec> {
  params: Parsed<S['params']>;
  query: Parsed<S['query']>;
  body: Parsed<S['body']>;
  auth: S['auth'] extends 'user' | 'admin' ? AuthUser : AuthUser | null;
  req: Request;
  res: Response;
}

export type RouteResult = { status?: number; data?: unknown } | undefined | void;

function parse(schema: ZodType | undefined, value: unknown, location: string): unknown {
  if (!schema) return undefined;
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    const { fieldErrors, formErrors } = z.flattenError(result.error);
    throw Errors.validation({ location, fieldErrors, formErrors });
  }
  return result.data;
}

export function route<S extends RouteSpec>(
  spec: S,
  handler: (ctx: RouteContext<S>) => Promise<RouteResult> | RouteResult,
): RequestHandler {
  return async (req, res) => {
    const auth = req.auth ?? null;
    if (spec.auth === 'user' || spec.auth === 'admin') {
      if (!auth) throw Errors.unauthenticated();
      if (spec.auth === 'admin' && auth.role !== 'admin') throw Errors.forbidden('Admins only');
    }

    const ctx = {
      params: parse(spec.params, req.params, 'params'),
      query: parse(spec.query, req.query, 'query'),
      body: parse(spec.body, req.body, 'body'),
      auth,
      req,
      res,
    } as RouteContext<S>;

    const result = await handler(ctx);
    if (res.headersSent) return;
    if (!result || result.data === undefined) {
      res.status(result?.status ?? 204).end();
      return;
    }
    res.status(result.status ?? 200).json({ data: result.data });
  };
}

export function clientMeta(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
  };
}
export type ClientMeta = ReturnType<typeof clientMeta>;
