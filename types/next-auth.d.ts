import "next-auth";

declare module "next-auth" {
    interface User {
        onboardingComplete?: boolean;
    }

    interface Session {
        user: User & {
            id: string;
            onboardingComplete?: boolean;
        };
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string;
        onboardingComplete?: boolean;
    }
}
