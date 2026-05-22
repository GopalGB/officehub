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
    async jwt({ token, user }) {
      if (user) {
        if (user.id) token.id = user.id;
        // role is set by the credentials authorize() callback
        const role = (user as { role?: string }).role;
        if (role) token.role = role as never;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as never;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const path = request.nextUrl.pathname;
      const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup");
      const isProtected =
        path.startsWith("/dashboard") || path.startsWith("/api/projects") || path.startsWith("/api/users");
      if (isProtected) return isLoggedIn;
      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
