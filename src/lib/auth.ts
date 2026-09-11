import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/**
 * Two sign-in paths, one User table (spec: "Both" email/password and
 * Google). Credentials forces JWT sessions in Auth.js (there's no
 * server-verifiable "session" for a password check the way there is for an
 * OAuth callback), so the whole app runs JWT sessions — the Prisma adapter
 * is still wired in purely so Google sign-ins get a durable User + Account
 * row to link back to.
 */
const providers: Provider[] = [
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : null;
      const password = typeof credentials?.password === "string" ? credentials.password : null;
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null; // no account, or a Google-only account

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
];

// Google is opt-in: only registered once real credentials are configured,
// so the "Continue with Google" button simply doesn't render until then
// rather than the app crashing on missing env vars.
export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
if (googleEnabled) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT strategy, 90-day idle expiry (Auth.js's default is 30 days) — the
  // session cookie is persistent either way (survives closing the
  // browser), this just keeps people signed in across longer gaps between
  // visits. Auth.js re-issues the cookie on activity, so it's a rolling
  // window, not a hard 90-day cutoff.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
