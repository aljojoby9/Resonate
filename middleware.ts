import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const session = req.auth;
    const isAuthed = !!session?.user;
    const onboardingComplete = (
        session?.user as { onboardingComplete?: boolean } | undefined
    )?.onboardingComplete;

    // 1. Redirect unauthenticated users away from protected routes
    const protectedPaths = ["/discover", "/matches", "/profile", "/settings", "/onboarding"];
    const isProtectedRoute = protectedPaths.some((path) => pathname.startsWith(path));

    if (isProtectedRoute && !isAuthed) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 2. Redirect authenticated users away from auth pages
    const authPaths = ["/login", "/verify"];
    const isAuthRoute = authPaths.some((path) => pathname.startsWith(path));

    if (isAuthRoute && isAuthed) {
        // Send to onboarding if not complete, otherwise discover
        return NextResponse.redirect(
            new URL(onboardingComplete ? "/discover" : "/onboarding/voice", req.url)
        );
    }

    // 3. Onboarding gate — authed users who haven't finished onboarding
    const isApp = ["/discover", "/matches", "/profile", "/settings"].some(
        (p) => pathname.startsWith(p)
    );
    if (isApp && isAuthed && !onboardingComplete) {
        return NextResponse.redirect(new URL("/onboarding/voice", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)",
    ],
};
