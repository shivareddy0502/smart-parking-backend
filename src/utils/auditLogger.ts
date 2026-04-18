import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAction(
  userId: string,
  userEmail: string,
  action: string,
  resource: string,
  resourceId?: string,
  details?: any
) {
  try {
    await (prisma as any).auditLog.create({
      data: {
        userId,
        userEmail,
        action,
        resource,
        resourceId,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
