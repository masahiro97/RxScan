import { router, protectedProcedure, adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { db } from "@/server/db";
import { stores, users } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const storeRouter = router({
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const { storeId } = ctx.session.user;
    return db.query.stores.findFirst({ where: eq(stores.id, storeId) });
  }),

  update: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      address: z.string().optional(),
      phone: z.string().optional(),
      licenseNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storeId } = ctx.session.user;
      await db.update(stores).set({ ...input, updatedAt: new Date() }).where(eq(stores.id, storeId));
      return { success: true };
    }),

  // ユーザー管理
  listUsers: adminProcedure.query(async ({ ctx }) => {
    const { storeId } = ctx.session.user;
    return db.query.users.findMany({
      where: eq(users.storeId, storeId),
      columns: { passwordHash: false, totpSecret: false },
      orderBy: users.name,
    });
  }),

  createUser: adminProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8, "パスワードは8文字以上"),
      name: z.string().min(1),
      role: z.enum(["pharmacist", "clerk", "admin"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storeId } = ctx.session.user;
      const passwordHash = await bcrypt.hash(input.password, 12);
      const [user] = await db.insert(users).values({
        storeId,
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
      }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
      return user;
    }),

  updateUser: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      role: z.enum(["pharmacist", "clerk", "admin"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storeId } = ctx.session.user;
      const { id, ...data } = input;
      await db.update(users).set({ ...data, updatedAt: new Date() })
        .where(and(eq(users.id, id), eq(users.storeId, storeId)));
      return { success: true };
    }),

  // TOTP設定
  setupTotp: protectedProcedure.mutation(async ({ ctx }) => {
    const { id: userId } = ctx.session.user;
    const { generateSecret, generateURI } = await import("otplib");
    const secret = generateSecret();
    const otpauth = generateURI({ issuer: "RxScan", label: ctx.session.user.email, secret });

    await db.update(users).set({ totpSecret: secret }).where(eq(users.id, userId));
    return { secret, otpauth };
  }),

  enableTotp: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const { id: userId } = ctx.session.user;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user?.totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "TOTP設定を先に開始してください" });

      const { verifySync } = await import("otplib");
      const result = verifySync({ token: input.code, secret: user.totpSecret });
      const isValid = result.valid;
      if (!isValid) throw new TRPCError({ code: "BAD_REQUEST", message: "認証コードが無効です" });

      await db.update(users).set({ totpEnabled: true }).where(eq(users.id, userId));
      return { success: true };
    }),
});
