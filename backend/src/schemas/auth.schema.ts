import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(1, 'Username or Email is required'),
    password: z.string().min(1, 'Password is required')
  })
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional()
  })
});

export const googleLoginSchema = z.object({
  body: z.object({
    credential: z.string().min(1, 'Google credential token or email is required'),
    email: z.string().email('Valid email is required').optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    avatarUrl: z.string().url().optional()
  })
});

