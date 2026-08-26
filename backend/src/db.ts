/**
 * @file backend/src/db.ts
 * @description Central Prisma client instance helper to prevent database pool exhaustion.
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export default prisma;
