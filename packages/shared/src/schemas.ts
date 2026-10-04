import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateSettingsSchema = z.object({
  uploadStrategy: z.enum(['manual', 'most_free', 'fill_first']).optional(),
  accountPriority: z.array(z.string()).optional(),
});

export const updateAccountSchema = z.object({
  label: z.string().max(50).nullable().optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export const createFolderSchema = z.object({
  parent: z.string().min(1, 'Parent node ID or account root is required'),
  name: z.string().min(1, 'Folder name cannot be empty').max(255),
});

export const renameNodeSchema = z.object({
  name: z.string().min(1, 'New name cannot be empty').max(255),
});

export const moveNodeSchema = z.object({
  destinationParent: z.string().min(1, 'Destination parent ID is required'),
  collisionPolicy: z.enum(['keep_both', 'replace', 'skip']).default('keep_both'),
});

export const copyNodeSchema = z.object({
  destinationParent: z.string().min(1, 'Destination parent ID is required'),
  name: z.string().max(255).optional(),
  collisionPolicy: z.enum(['keep_both', 'replace', 'skip']).default('keep_both'),
});

export const initUploadSchema = z.object({
  parent: z.string().min(1, 'Parent is required (use "root" for virtual root)'),
  fileName: z.string().min(1, 'File name is required'),
  size: z.number().int().nonnegative('File size must be non-negative'),
  mimeType: z.string().default('application/octet-stream'),
  strategy: z.enum(['manual', 'most_free', 'fill_first']).optional(),
  accountId: z.string().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  accounts: z.string().optional(), // comma-separated account IDs
  type: z.enum(['all', 'folder', 'document', 'spreadsheet', 'presentation', 'pdf', 'image', 'video', 'audio', 'archive', 'code']).default('all'),
  modifiedAfter: z.string().optional(),
  trashed: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameNodeInput = z.infer<typeof renameNodeSchema>;
export type MoveNodeInput = z.infer<typeof moveNodeSchema>;
export type CopyNodeInput = z.infer<typeof copyNodeSchema>;
export type InitUploadInput = z.infer<typeof initUploadSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
