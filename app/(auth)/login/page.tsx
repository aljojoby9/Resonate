"use client";

import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") ?? "/discover";
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [pendingGoogle, setPendingGoogle] = useState(false);
    const [pendingMagicLink, setPendingMagicLink] = useState(false);

    const handleGoogleSignIn = async () => {
        setPendingGoogle(true);
        setStatus(null);
        await signIn("google", { callbackUrl });
        setPendingGoogle(false);
    };

    const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setPendingMagicLink(true);
        setStatus(null);

        const result = await signIn("resend", {
            email,
            callbackUrl,
            redirect: false,
        });

        if (result?.error) {
            setStatus("Unable to send magic link. Check your email and try again.");
        } else {
            setStatus("Magic link sent. Check your inbox.");
            setEmail("");
        }

        setPendingMagicLink(false);
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-14">
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(circle at 15% 20%, rgba(74,247,196,0.14), transparent 42%), radial-gradient(circle at 80% 10%, rgba(56,227,255,0.14), transparent 36%), radial-gradient(circle at 60% 85%, rgba(199,125,255,0.2), transparent 40%), linear-gradient(155deg, #02040a 0%, #04060f 45%, #070d1d 100%)",
                }}
            />
            <div
                className="pointer-events-none absolute h-[28rem] w-[28rem] rounded-full blur-3xl"
                style={{
                    background:
                        "conic-gradient(from 45deg, rgba(74,247,196,0.22), rgba(72,202,228,0.12), rgba(199,125,255,0.2), rgba(74,247,196,0.12))",
                }}
            />

            <section className="relative z-10 w-full max-w-md rounded-3xl glass p-8 shadow-[0_16px_60px_rgba(1,5,14,0.65)]">
                <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55 }}
                    className="font-display text-center text-5xl tracking-tight text-gradient-bio"
                    style={{ fontVariationSettings: '"wght" 300' }}
                >
                    <motion.span
                        initial={{ fontVariationSettings: '"wght" 300' }}
                        animate={{ fontVariationSettings: '"wght" 600' }}
                        transition={{ duration: 0.9, delay: 0.15 }}
                    >
                        RESONATE
                    </motion.span>
                </motion.h1>

                <p className="mt-3 text-center text-sm text-white/65">
                    Match at the frequency of who you are.
                </p>

                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={pendingGoogle}
                    className="mt-8 w-full rounded-xl border border-[var(--glass-border)] bg-[rgba(74,247,196,0.08)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] transition-all duration-300 hover:scale-[1.01] hover:border-[rgba(74,247,196,0.55)] hover:shadow-[0_0_28px_rgba(74,247,196,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {pendingGoogle ? "Connecting..." : "Continue with Google"}
                </button>

                <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs uppercase tracking-[0.18em] text-white/45">
                        or
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={handleMagicLink} className="space-y-3">
                    <label
                        htmlFor="email"
                        className="block text-xs uppercase tracking-[0.16em] text-white/55"
                    >
                        Email magic link
                    </label>
                    <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@domain.com"
                        className="w-full rounded-xl border border-white/10 bg-[rgba(7,13,29,0.72)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--bio-deep)] focus:shadow-[0_0_0_3px_rgba(72,202,228,0.18)]"
                    />
                    <button
                        type="submit"
                        disabled={pendingMagicLink}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-[var(--bio-deep)] hover:bg-[rgba(72,202,228,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {pendingMagicLink ? "Sending..." : "Send magic link"}
                    </button>
                </form>

                {status && (
                    <p className="mt-4 text-center text-xs text-[var(--text-secondary)]">
                        {status}
                    </p>
                )}
            </section>
        </main>
    );
}
