import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const id = user?.id ?? token.id;
      if (!id) return null;
      const current = await db.user.findUnique({ where: { id } });
      if (!current?.active) return null;
      // A password reset revokes existing JWTs without storing credentials in them.
      const credentialVersion = createHash("sha256").update(current.passwordHash).digest("hex");
      if (!user && token.credentialVersion !== credentialVersion) return null;
      return {
        ...token,
        id: current.id,
        role: current.role,
        name: current.name,
        email: current.email,
        credentialVersion,
      };
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
        if (!user || !user.active || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
