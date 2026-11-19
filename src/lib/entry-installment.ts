import {z} from 'zod';
export const entryInstallment=z.object({terms:z.number().int().min(1).max(600).optional(),firstDate:z.string().default(''),fees:z.number().int().nonnegative().max(100000000000).optional()});
export type EntryInstallment=z.infer<typeof entryInstallment>;
