import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { API_URL } from "@/lib/api";

function normalizeFrontendUrl(): string {
  const raw = process.env.FRONTEND_URL ?? process.env.NEXTAUTH_URL ?? "https://vidra.life";
  return raw.replace(/\/+$/, "");
}

const FRONTEND_URL = normalizeFrontendUrl();

if ((process.env.NEXTAUTH_URL ?? "").includes("hellolexa.space")) {
  console.warn("NEXTAUTH_URL is pointing to a legacy domain. Set NEXTAUTH_URL=https://vidra.life");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password
          })
        });

        if (!loginRes.ok) {
          return null;
        }

        const tokenData = (await loginRes.json()) as { access_token: string };

        const meRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`
          }
        });

        if (!meRes.ok) {
          return null;
        }

        const user = (await meRes.json()) as { id: string; email: string; name?: string; tier: string };

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          accessToken: tokenData.access_token
        };
      }
    })
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as { accessToken: string }).accessToken;
        token.tier = (user as { tier: string }).tier;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.tier = token.tier as string;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      const allowedBase = FRONTEND_URL || baseUrl;
      if (url.startsWith("/")) {
        return `${allowedBase}${url}`;
      }

      try {
        const target = new URL(url);
        const allowedOrigin = new URL(allowedBase).origin;
        if (target.origin === allowedOrigin) {
          return url;
        }
      } catch {
        // fall back to login on malformed URLs
      }

      return `${allowedBase}/login`;
    }
  },
  pages: {
    signIn: "/login"
  }
});
