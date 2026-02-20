import { auth } from "@/auth";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { redirect } from "next/navigation";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    if (!session) redirect("/login");
    if (!session.user.onboardingComplete) redirect("/onboarding/voice");

    return (
        <div className="relative mx-auto min-h-screen max-w-md overflow-hidden">
            <main className="pb-20">{children}</main>
            <BottomNav />
        </div>
    );
}
