import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";

export type AuditAction =
  | "view" | "create" | "update" | "delete" | "approve" | "reject"
  | "dispense" | "upload" | "login" | "logout" | "export";

export type ResourceType =
  | "prescription" | "patient" | "medicine" | "user" | "store" | "audit_log";

interface AuditLogInput {
  userId: string;
  storeId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.userId,
      storeId: input.storeId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      // 個人情報をdetailsに含めない
      details: sanitizeDetails(input.details),
      ipAddress: input.ipAddress,
    });
  } catch (err) {
    // 監査ログの失敗はサイレントに（本処理を止めない）
    console.error("[AuditLog] 記録失敗:", err);
  }
}

/** 個人情報フィールドをdetailsから除去 */
function sanitizeDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const SENSITIVE_KEYS = new Set([
    "name", "nameKana", "birthDate", "insurerNumber", "insuredNumber",
    "insuranceSymbol", "phone", "address", "email", "passwordHash",
  ]);
  return Object.fromEntries(
    Object.entries(details).filter(([k]) => !SENSITIVE_KEYS.has(k))
  );
}
