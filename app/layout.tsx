import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
    title: "RESONATE — Emotional Frequency Dating",
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
        <html lang="en" className="dark">
            <body className="antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
