import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { API_URL } from "@/lib/api";

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
    }
  },
  pages: {
    signIn: "/login"
  }
});
