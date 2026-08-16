import { z } from 'zod';
import { BranchType } from '@prisma/client';

export const branchBodySchema = z
  .object({
    name: z.string().trim().optional(),
    branchName: z.string().trim().optional(),
    outletName: z.string().trim().optional(),

    code: z.string().trim().optional(),
    branchCode: z.string().trim().optional(),
    outletCode: z.string().trim().optional(),

    type: z.any().optional(),
    branchType: z.any().optional(),
    outletType: z.any().optional(),

    address: z.string().trim().optional(),
    location: z.string().trim().optional(),

    email: z.string().trim().optional().or(z.literal('')).nullable(),
    contactEmail: z.string().trim().optional().or(z.literal('')).nullable(),

    phone: z.string().trim().optional().or(z.literal('')).nullable(),
    contactPhone: z.string().trim().optional().or(z.literal('')).nullable()
  })
  .superRefine((data, ctx) => {
    const rawName = (data.name || data.branchName || data.outletName || '').trim();
    const rawCode = (data.code || data.branchCode || data.outletCode || '').trim().toUpperCase();
    const rawAddress = (data.address || data.location || '').trim();

    if (!rawName || rawName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'Outlet / Branch name must be at least 2 characters'
      });
    }

    if (!rawCode || rawCode.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['code'],
        message: 'Branch code must be at least 2 characters'
      });
    } else if (!/^[A-Za-z0-9\-_]+$/.test(rawCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['code'],
        message: 'Branch code can only contain letters, numbers, hyphens, and underscores'
      });
    }

    if (!rawAddress || rawAddress.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address'],
        message: 'Physical address must be at least 3 characters'
      });
    }
  })
  .transform((data) => {
    const rawName = (data.name || data.branchName || data.outletName || '').trim();
    const rawCode = (data.code || data.branchCode || data.outletCode || '').trim().toUpperCase();
    const rawAddress = (data.address || data.location || '').trim();
    const rawType = data.type || data.branchType || data.outletType || 'RESTAURANT';
    const rawEmail = (data.email || data.contactEmail || '')?.trim() || null;
    const rawPhone = (data.phone || data.contactPhone || '')?.trim() || null;

    let validType: BranchType = BranchType.RESTAURANT;
    if (rawType && Object.values(BranchType).includes(rawType as any)) {
      validType = rawType as BranchType;
    } else if (typeof rawType === 'string' && rawType.toUpperCase().includes('HOTEL')) {
      validType = BranchType.HOTEL;
    } else if (typeof rawType === 'string' && rawType.toUpperCase().includes('HYBRID')) {
      validType = BranchType.HYBRID;
    } else {
      validType = BranchType.RESTAURANT;
    }

    return {
      name: rawName,
      code: rawCode,
      type: validType,
      address: rawAddress,
      email: rawEmail,
      phone: rawPhone
    };
  });

export const createBranchSchema = z.object({
  body: branchBodySchema
});

export type CreateBranchDto = z.infer<typeof branchBodySchema>;
