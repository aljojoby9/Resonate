import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/server/db";
import {
    users,
    accounts,
    sessions,
    verificationTokens,
} from "@/server/db/schema";

const hasDb = !!process.env.DATABASE_URL;

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...(hasDb && {
        adapter: DrizzleAdapter(db, {
            usersTable: users,
            accountsTable: accounts,
            sessionsTable: sessions,
            verificationTokensTable: verificationTokens,
        }),
    }),
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Resend({
            from: process.env.RESEND_FROM_EMAIL ?? "hello@resonate.app",
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.onboardingComplete = Boolean(
                    (user as { onboardingComplete?: boolean }).onboardingComplete
                );
            }
            return token;
        },
        session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string;
                session.user.onboardingComplete = Boolean(
                    token.onboardingComplete
                );
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
});

export const { GET, POST } = handlers;
