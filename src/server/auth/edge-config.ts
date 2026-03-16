/**
 * Edge Runtime 互換の NextAuth 最小設定
 * middleware.ts でのみ使用する（crypto/bcrypt/DB を含まない）
 */
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

const edgeAuthConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // Edge では provider 不要（JWT 検証のみ）
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.storeId = (user as { storeId: string }).storeId;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.storeId = token.storeId as string;
      }
      return session;
    },
  },
};

export const { auth } = NextAuth(edgeAuthConfig);
