import { z } from 'zod';
import { LIMITS } from '../constants';
import { emailSchema } from './common';

export const signupInput = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(LIMITS.password.min, `Use at least ${LIMITS.password.min} characters`)
    .max(LIMITS.password.max),
  displayName: z
    .string()
    .trim()
    .min(LIMITS.displayName.min, 'Tell us what to call you')
    .max(LIMITS.displayName.max),
});
export type SignupInput = z.infer<typeof signupInput>;

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(LIMITS.password.max),
});
export type LoginInput = z.infer<typeof loginInput>;
