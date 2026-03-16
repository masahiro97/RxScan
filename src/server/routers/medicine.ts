import { router, protectedProcedure, adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { db } from "@/server/db";
import { medicines } from "@/server/db/schema";
import { eq, ilike, or, sql } from "drizzle-orm";
import { findMedicineCandidates, searchMedicines } from "@/server/services/medicine-matcher";

export const medicineRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return searchMedicines(input.query, input.limit);
    }),

  suggest: protectedProcedure
    .input(z.object({ rawName: z.string(), limit: z.number().default(5) }))
    .query(async ({ input }) => {
      return findMedicineCandidates(input.rawName, input.limit);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.medicines.findFirst({ where: eq(medicines.id, input.id) });
    }),

  list: protectedProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().default(50) }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;
      const rows = await db.query.medicines.findMany({
        where: eq(medicines.isActive, true),
        limit: input.limit,
        offset,
        orderBy: medicines.name,
      });
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(medicines).where(eq(medicines.isActive, true));
      return { rows, total: Number(count) };
    }),
});
