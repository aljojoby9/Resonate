"use client";

import { api } from "@/lib/trpc";

export default function DiscoverPage() {
    const { data, isLoading, error } = api.users.getMe.useQuery();

    return (
        <main className="mx-auto max-w-4xl px-6 py-12">
            <h1 className="font-display text-4xl text-gradient-bio">Discover</h1>
            <div className="mt-6 rounded-2xl glass p-6">
                {isLoading && <p>Loading your profile...</p>}
                {error && (
                    <p className="text-red-300">
                        Failed to load user: {error.message}
                    </p>
                )}
                {data && (
                    <pre className="overflow-x-auto text-sm text-white/80">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                )}
            </div>
        </main>
    );
}
