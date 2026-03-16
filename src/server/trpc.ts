import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@/server/auth/config";
import superjson from "superjson";
import { z } from "zod";

export async function createTRPCContext() {
  const session = await auth();
  return { session };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** 認証必須プロシージャ */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

/** 管理者専用プロシージャ */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
  }
  return next({ ctx });
});

/** 薬剤師以上（pharmacist / admin）専用 */
export const pharmacistProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!["pharmacist", "admin"].includes(ctx.session.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "薬剤師権限が必要です" });
  }
  return next({ ctx });
});
