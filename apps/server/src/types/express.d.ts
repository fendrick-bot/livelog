import type { AuthUser } from '../lib/tokens';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by the authenticate middleware: null for anonymous visitors. */
    auth?: AuthUser | null;
  }
}
