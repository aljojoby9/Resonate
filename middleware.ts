import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const isAuth = !!req.auth;

    // Protected routes — redirect unauthenticated users to login
    const protectedPaths = ["/discover", "/matches", "/profile", "/settings"];
    const isProtectedRoute = protectedPaths.some((path) =>
        pathname.startsWith(path)
    );

    if (isProtectedRoute && !isAuth) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from auth pages
    const authPaths = ["/login", "/verify"];
    const isAuthRoute = authPaths.some((path) => pathname.startsWith(path));

    if (isAuthRoute && isAuth) {
        return NextResponse.redirect(new URL("/discover", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)",
    ],
};
