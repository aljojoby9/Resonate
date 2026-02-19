"use client";

import { signOut } from "next-auth/react";

export default function ProfilePage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-12">
            <h1 className="font-display text-4xl text-gradient-bio">Profile</h1>
            <div className="mt-6 rounded-2xl glass p-6">
                <p className="text-white/75">Signed in and protected.</p>
                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="mt-5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-[var(--bio-deep)] hover:bg-[rgba(72,202,228,0.14)]"
                >
                    Sign out
                </button>
            </div>
        </main>
    );
}
