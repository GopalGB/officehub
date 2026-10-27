import type { NextAuthConfig } from "next-auth";

// Edge-safe config shared by middleware and the full auth instance.
// Do NOT import Prisma / bcrypt here — middleware runs on the edge runtime.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        if (user.id) token.id = user.id;
        // role is set by the credentials authorize() callback
        const role = (user as { role?: string }).role;
        if (role) token.role = role as never;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as never;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isInviteRoute = path.startsWith("/invite/");
      const isProtected =
        path.startsWith("/dashboard") ||
        path.startsWith("/api/projects") ||
        path.startsWith("/api/users") ||
        path.startsWith("/api/me") ||
        path.startsWith("/api/search") ||
        path.startsWith("/api/workspace");
      if (isInviteRoute) return true;
      if (isProtected) return isLoggedIn;
      // Login/signup perform their own redirect after the Node auth callback
      // checks current account state. An old edge JWT must not cause a loop.
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
