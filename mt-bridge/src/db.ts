/**
 * @file mt-bridge/src/db.ts
 * @description Local database connector instance helper for mt-bridge package.
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export default prisma;
