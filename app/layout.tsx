import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
    display: "swap",
});

export const metadata: Metadata = {
    title: { default: "RESONATE", template: "%s | RESONATE" },
    description:
        "The world's first emotional frequency dating platform. Connect through resonance, not selfies.",
    openGraph: {
        title: "RESONATE — Emotional Frequency Dating",
        description:
            "Match at the frequency of who you actually are. No swipes — just resonance.",
        siteName: "RESONATE",
        type: "website",
    },
    icons: {
        icon: "/favicon.ico",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`dark ${inter.variable}`}>
            <body className="bg-depth-abyss font-sans text-white antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
