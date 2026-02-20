"use client";

import { signIn } from "next-auth/react";
import { motion } from "framer-motion";

export default function LoginPage() {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
            {/* Ambient background glow orbs */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(74,247,196,0.07) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(199,125,255,0.07) 0%, transparent 70%)",
                    pointerEvents: "none",
                }}
            />

            {/* Subtle animated rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[1, 2, 3].map((i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: [0, 0.04, 0], scale: [0.8, 1.6, 2.2] }}
                        transition={{
                            duration: 6,
                            delay: i * 1.5,
                            repeat: Infinity,
                            ease: "easeOut",
                        }}
                        style={{
                            position: "absolute",
                            width: 400,
                            height: 400,
                            borderRadius: "50%",
                            border: "1px solid var(--bio-pulse)",
                        }}
                    />
                ))}
            </div>

            {/* Card */}
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="glass-glow relative z-10 flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl px-8 py-12"
            >
                {/* Logo wordmark */}
                <div className="flex flex-col items-center gap-2">
                    <motion.h1
                        className="font-display text-5xl tracking-tight text-gradient-bio"
                        initial={{ fontVariationSettings: '"wght" 300' }}
                        animate={{ fontVariationSettings: '"wght" 600' }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    >
                        RESONATE
                    </motion.h1>
                    <p
                        className="text-center text-sm leading-relaxed"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Match at the frequency of who you actually are.
                    </p>
                </div>

                {/* Divider */}
                <div
                    style={{
                        width: "100%",
                        height: 1,
                        background:
                            "linear-gradient(90deg, transparent, var(--glass-border), transparent)",
                    }}
                />

                {/* Google sign in */}
                <div className="flex w-full flex-col gap-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => signIn("google", { callbackUrl: "/onboarding/voice" })}
                        className="glow-pulse flex w-full items-center justify-center gap-3 rounded-full px-6 py-3.5 text-sm font-medium transition-colors"
                        style={{
                            background: "var(--glass-surface)",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text-primary)",
                        }}
                    >
                        {/* Google Icon */}
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
                            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </motion.button>
                </div>

                {/* Footer */}
                <p
                    className="text-center text-xs"
                    style={{ color: "var(--text-ghost)" }}
                >
                    By continuing, you agree to our Terms and Privacy Policy.
                </p>
            </motion.div>
        </div>
    );
}
