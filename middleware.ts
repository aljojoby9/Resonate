import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const isAuth = !!req.auth?.user;
    const onboardingComplete = Boolean(req.auth?.user?.onboardingComplete);
    const isAuthRoute =
        pathname.startsWith("/login") || pathname.startsWith("/verify");
    const isOnboardingRoute = pathname.startsWith("/onboarding");
    const isRootRoute = pathname === "/";

    if (!isAuth && !isAuthRoute && !isRootRoute) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (!isAuth && isRootRoute) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    if (isAuthRoute && isAuth) {
        if (!onboardingComplete) {
            return NextResponse.redirect(new URL("/onboarding/voice", req.url));
        }
        return NextResponse.redirect(new URL("/discover", req.url));
    }

    if (isAuth && !onboardingComplete && !isOnboardingRoute) {
        return NextResponse.redirect(new URL("/onboarding/voice", req.url));
    }

    if (isAuth && onboardingComplete && isOnboardingRoute) {
        return NextResponse.redirect(new URL("/discover", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)"],
};
