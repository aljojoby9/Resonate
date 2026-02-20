import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Analytics } from "@vercel/analytics/react";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { Toaster } from "@/components/ui/toaster";
import "@/styles/globals.css";

export const metadata: Metadata = {
    title: { default: "RESONATE", template: "%s | RESONATE" },
    description: "Match at the frequency of who you actually are.",
    manifest: "/manifest.webmanifest",
    themeColor: "#04060f",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body
                className={`bg-depth-abyss font-sans text-white antialiased ${GeistSans.className}`}
            >
                <TRPCReactProvider>
                    {children}
                    <Toaster />
                </TRPCReactProvider>
                <Analytics />
            </body>
        </html>
    );
}
