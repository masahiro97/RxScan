import { router, protectedProcedure, pharmacistProcedure } from "@/server/trpc";
import { z } from "zod";
import { db } from "@/server/db";
import {
  prescriptions, prescriptionItems, prescriptionImages,
  ocrResults, patients,
} from "@/server/db/schema";
import { eq, and, desc, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { runOcrPipeline } from "@/server/services/ocr/ocr-orchestrator";
import { logAudit } from "@/server/services/audit-logger";
import { getSignedUploadUrl, getSignedDownloadUrl } from "@/lib/s3";
import { generateRxNumber } from "@/lib/utils";

const prescriptionStatusEnum = z.enum(["pending", "reviewing", "approved", "dispensed", "rejected"]);

export const prescriptionRouter = router({
  // 一覧取得
  list: protectedProcedure
    .input(z.object({
      status: prescriptionStatusEnum.optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { storeId } = ctx.session.user;
      const offset = (input.page - 1) * input.limit;

      const conditions = [eq(prescriptions.storeId, storeId)];
      if (input.status) conditions.push(eq(prescriptions.status, input.status));

      const rows = await db.query.prescriptions.findMany({
        where: and(...conditions),
        with: {
          patient: { columns: { id: true, name: true, nameKana: true } },
          scannedBy: { columns: { id: true, name: true } },
          images: { columns: { id: true, s3Key: true }, limit: 1 },
        },
        orderBy: [desc(prescriptions.createdAt)],
        limit: input.limit,
        offset,
      });

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(prescriptions)
        .where(and(...conditions));

      return { rows, total: Number(count), page: input.page, limit: input.limit };
    }),

  // 詳細取得
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;

      const rx = await db.query.prescriptions.findFirst({
        where: and(
          eq(prescriptions.id, input.id),
          eq(prescriptions.storeId, storeId),
        ),
        with: {
          patient: true,
          scannedBy: { columns: { id: true, name: true } },
          approvedBy: { columns: { id: true, name: true } },
          items: { with: { medicine: true }, orderBy: (t) => t.sortOrder },
          images: true,
          ocrResults: { orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 1 },
        },
      });

      if (!rx) throw new TRPCError({ code: "NOT_FOUND", message: "処方箋が見つかりません" });

      await logAudit({
        userId,
        storeId,
        action: "view",
        resourceType: "prescription",
        resourceId: input.id,
      });

      // presigned URLs を生成
      const imagesWithUrls = await Promise.all(
        rx.images.map(async (img) => ({
          ...img,
          url: await getSignedDownloadUrl(img.s3Key),
        }))
      );

      return { ...rx, images: imagesWithUrls };
    }),

  // アップロード用 presigned URL 発行
  getUploadUrl: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/tiff", "application/pdf"]),
      fileSizeBytes: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storeId } = ctx.session.user;
      const s3Key = `${storeId}/prescriptions/${Date.now()}-${input.fileName}`;
      const uploadUrl = await getSignedUploadUrl(s3Key, input.mimeType);
      return { uploadUrl, s3Key };
    }),

  // 処方箋作成 + OCR 実行
  createAndOcr: protectedProcedure
    .input(z.object({
      s3Key: z.string(),
      mimeType: z.enum(["image/jpeg", "image/png", "image/tiff", "application/pdf"]),
      fileSizeBytes: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;
      const rxNumber = generateRxNumber();

      // 処方箋レコード作成
      const [rx] = await db.insert(prescriptions).values({
        rxNumber,
        storeId,
        scannedById: userId,
        status: "pending",
      }).returning();

      if (!rx) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // 画像レコード作成
      await db.insert(prescriptionImages).values({
        prescriptionId: rx.id,
        s3Key: input.s3Key,
        s3Bucket: process.env.S3_BUCKET_NAME!,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes,
        pageNumber: 1,
      });

      await logAudit({
        userId,
        storeId,
        action: "create",
        resourceType: "prescription",
        resourceId: rx.id,
      });

      // OCR 非同期実行（バックグラウンド）
      void runOcrInBackground(rx.id, input.s3Key, input.mimeType, storeId, userId);

      return { id: rx.id, rxNumber };
    }),

  // OCR結果をレビュー画面用に取得
  getOcrResult: protectedProcedure
    .input(z.object({ prescriptionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { storeId } = ctx.session.user;
      const rx = await db.query.prescriptions.findFirst({
        where: and(
          eq(prescriptions.id, input.prescriptionId),
          eq(prescriptions.storeId, storeId),
        ),
        with: {
          ocrResults: { orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 1 },
        },
      });
      if (!rx) throw new TRPCError({ code: "NOT_FOUND" });
      return rx.ocrResults[0] ?? null;
    }),

  // レビュー内容を保存（ドラフト）
  saveReview: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      patientId: z.string().uuid().optional(),
      institutionName: z.string().optional(),
      institutionCode: z.string().optional(),
      doctorName: z.string().optional(),
      doctorDepartment: z.string().optional(),
      prescribedDate: z.string().optional(),
      expiryDate: z.string().optional(),
      isGenericSubstitutable: z.boolean().optional(),
      dispensingNotes: z.string().optional(),
      items: z.array(z.object({
        id: z.string().uuid().optional(),
        rpNumber: z.number(),
        rawMedicineName: z.string(),
        medicineId: z.string().uuid().optional(),
        isGenericName: z.boolean(),
        dosage: z.string(),
        administration: z.string(),
        durationDays: z.number().optional(),
        totalQuantity: z.string().optional(),
        isPrn: z.boolean(),
        notes: z.string().optional(),
        confidenceScore: z.number().optional(),
        sortOrder: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;

      const rx = await db.query.prescriptions.findFirst({
        where: and(eq(prescriptions.id, input.id), eq(prescriptions.storeId, storeId)),
      });
      if (!rx) throw new TRPCError({ code: "NOT_FOUND" });

      const { items, id, ...rxData } = input;

      await db.update(prescriptions)
        .set({ ...rxData, status: "reviewing", updatedAt: new Date() })
        .where(eq(prescriptions.id, id));

      // 既存アイテム削除 → 再挿入
      await db.delete(prescriptionItems).where(eq(prescriptionItems.prescriptionId, id));
      if (items.length > 0) {
        await db.insert(prescriptionItems).values(
          items.map((item) => ({
            prescriptionId: id,
            rpNumber: item.rpNumber,
            rawMedicineName: item.rawMedicineName,
            medicineId: item.medicineId,
            isGenericName: item.isGenericName,
            dosage: item.dosage,
            administration: item.administration,
            durationDays: item.durationDays,
            totalQuantity: item.totalQuantity,
            isPrn: item.isPrn,
            notes: item.notes,
            confidenceScore: item.confidenceScore?.toString(),
            sortOrder: item.sortOrder,
          }))
        );
      }

      await logAudit({ userId, storeId, action: "update", resourceType: "prescription", resourceId: id });
      return { success: true };
    }),

  // 承認
  approve: pharmacistProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;

      const rx = await db.query.prescriptions.findFirst({
        where: and(eq(prescriptions.id, input.id), eq(prescriptions.storeId, storeId)),
      });
      if (!rx) throw new TRPCError({ code: "NOT_FOUND" });
      if (rx.status === "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "既に承認済みです" });

      await db.update(prescriptions).set({
        status: "approved",
        approvedById: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(prescriptions.id, input.id));

      await logAudit({ userId, storeId, action: "approve", resourceType: "prescription", resourceId: input.id });
      return { success: true };
    }),

  // 否認
  reject: pharmacistProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;
      await db.update(prescriptions).set({
        status: "rejected",
        rejectionReason: input.reason,
        updatedAt: new Date(),
      }).where(and(eq(prescriptions.id, input.id), eq(prescriptions.storeId, storeId)));

      await logAudit({ userId, storeId, action: "reject", resourceType: "prescription", resourceId: input.id, details: { reason: input.reason } });
      return { success: true };
    }),

  // ステータス統計（ダッシュボード用）
  stats: protectedProcedure.query(async ({ ctx }) => {
    const { storeId } = ctx.session.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await db.execute<{ status: string; count: string }>(sql`
      SELECT status, COUNT(*) as count
      FROM prescriptions
      WHERE store_id = ${storeId}
        AND created_at >= ${today}
      GROUP BY status
    `);

    const statsMap = Object.fromEntries(rows.rows.map((r) => [r.status, Number(r.count)]));
    return {
      pending: statsMap.pending ?? 0,
      reviewing: statsMap.reviewing ?? 0,
      approved: statsMap.approved ?? 0,
      dispensed: statsMap.dispensed ?? 0,
      rejected: statsMap.rejected ?? 0,
      total: Object.values(statsMap).reduce((a, b) => a + b, 0),
    };
  }),
});

// OCR バックグラウンド実行
async function runOcrInBackground(
  prescriptionId: string,
  s3Key: string,
  mimeType: string,
  storeId: string,
  userId: string,
) {
  try {
    const { getObjectBuffer } = await import("@/lib/s3");
    const imageBuffer = await getObjectBuffer(s3Key);

    const result = await runOcrPipeline(imageBuffer, mimeType);

    // OCR 結果を保存
    await db.insert(ocrResults).values({
      prescriptionId,
      parsedData: result as unknown as Record<string, unknown>,
      confidenceScores: {
        overall: result.meta.overallConfidence,
        institution: result.institution.confidence,
        doctor: result.doctor.confidence,
        patient: result.patient.confidence,
      },
      pipeline: result.meta.pipeline,
      processingTimeMs: result.meta.processingTimeMs,
    });

    // 処方箋にOCR結果を反映
    await db.update(prescriptions).set({
      status: "reviewing",
      institutionName: result.institution.name,
      institutionCode: result.institution.code,
      institutionAddress: result.institution.address,
      institutionPhone: result.institution.phone,
      doctorName: result.doctor.name,
      doctorDepartment: result.doctor.department,
      prescribedDate: result.prescription.date,
      expiryDate: result.prescription.expiryDate,
      isGenericSubstitutable: result.prescription.isGenericSubstitutable,
      dispensingNotes: result.prescription.dispensingNotes,
      ocrConfidenceAvg: result.meta.overallConfidence.toString(),
      ocrPipeline: result.meta.pipeline,
      updatedAt: new Date(),
    }).where(eq(prescriptions.id, prescriptionId));

    // 処方明細を保存
    if (result.items.length > 0) {
      await db.insert(prescriptionItems).values(
        result.items.map((item, idx) => ({
          prescriptionId,
          rpNumber: item.rpNumber,
          rawMedicineName: item.medicineName,
          isGenericName: item.isGenericName,
          dosage: item.dosage,
          administration: item.administration,
          durationDays: item.durationDays,
          totalQuantity: item.totalQuantity,
          isPrn: item.isPrn,
          notes: item.notes,
          confidenceScore: item.confidence.toString(),
          sortOrder: idx,
        }))
      );
    }
  } catch (err) {
    console.error("[OCR] バックグラウンド処理エラー:", err);
    await db.update(prescriptions).set({ status: "pending", updatedAt: new Date() })
      .where(eq(prescriptions.id, prescriptionId));
  }
}
