import { z } from 'zod';
import { BranchType } from '@prisma/client';

export const createBranchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters').max(100),
  code: z.string().min(2, 'Branch code must be at least 2 characters').max(30).toUpperCase(),
  type: z.nativeEnum(BranchType).default(BranchType.HYBRID),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(25).optional().or(z.literal('')),
  address: z.string().min(3, 'Address must be at least 3 characters').max(300)
});

export type CreateBranchDto = z.infer<typeof createBranchSchema>;
