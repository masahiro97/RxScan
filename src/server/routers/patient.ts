import { router, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { db } from "@/server/db";
import { patients, prescriptions } from "@/server/db/schema";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logAudit } from "@/server/services/audit-logger";

const patientInput = z.object({
  name: z.string().min(1, "氏名は必須です"),
  nameKana: z.string().optional(),
  birthDate: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  insurerNumber: z.string().optional(),
  insuredNumber: z.string().optional(),
  insuranceSymbol: z.string().optional(),
  copayRatio: z.number().optional(),
  allergies: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const patientRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { storeId } = ctx.session.user;
      const offset = (input.page - 1) * input.limit;

      const conditions = [eq(patients.storeId, storeId)];
      if (input.search) {
        conditions.push(
          or(
            ilike(patients.name, `%${input.search}%`),
            ilike(patients.nameKana, `%${input.search}%`),
          )!
        );
      }

      const rows = await db.query.patients.findMany({
        where: and(...conditions),
        orderBy: [patients.name],
        limit: input.limit,
        offset,
      });

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(and(...conditions));

      return { rows, total: Number(count) };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;

      const patient = await db.query.patients.findFirst({
        where: and(eq(patients.id, input.id), eq(patients.storeId, storeId)),
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "患者が見つかりません" });

      await logAudit({ userId, storeId, action: "view", resourceType: "patient", resourceId: input.id });

      const rxHistory = await db.query.prescriptions.findMany({
        where: and(eq(prescriptions.patientId, input.id), eq(prescriptions.storeId, storeId)),
        orderBy: [desc(prescriptions.createdAt)],
        limit: 20,
        with: { items: { with: { medicine: true } } },
      });

      return { patient, prescriptions: rxHistory };
    }),

  create: protectedProcedure
    .input(patientInput)
    .mutation(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;
      const [patient] = await db.insert(patients).values({ ...input, storeId }).returning();
      if (!patient) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await logAudit({ userId, storeId, action: "create", resourceType: "patient", resourceId: patient.id });
      return patient;
    }),

  update: protectedProcedure
    .input(patientInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { storeId, id: userId } = ctx.session.user;
      const { id, ...data } = input;
      await db.update(patients).set({ ...data, updatedAt: new Date() })
        .where(and(eq(patients.id, id), eq(patients.storeId, storeId)));
      await logAudit({ userId, storeId, action: "update", resourceType: "patient", resourceId: id });
      return { success: true };
    }),
});
