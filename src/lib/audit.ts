import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function logAudit(params: {
  adminId: number | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}) {
  await db.insert(auditLogs).values({
    adminId: params.adminId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId != null ? String(params.entityId) : null,
    oldValue: params.oldValue ? JSON.parse(JSON.stringify(params.oldValue)) : null,
    newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : null,
    ipAddress: params.ipAddress ?? null,
  });
}
