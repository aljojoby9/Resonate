import { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        user: DefaultSession["user"] & {
            id: string;
            onboardingComplete: boolean;
        };
    }

    interface User {
        onboardingComplete?: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string;
        onboardingComplete?: boolean;
    }
}
