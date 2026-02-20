export default function OnboardingVoicePage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
            <h1 className="font-display text-4xl text-gradient-bio">Welcome to RESONATE</h1>
            <p style={{ color: "var(--text-secondary)" }}>
                Let&apos;s set up your emotional frequency profile.
            </p>
            <p
                className="text-xs"
                style={{ color: "var(--text-ghost)" }}
            >
                Onboarding flow coming in Day 3...
            </p>
        </div>
    );
}
