export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="font-display text-6xl font-light tracking-tight text-gradient-bio">
        RESONATE
      </h1>
      <p className="mt-4 text-lg" style={{ color: "var(--text-secondary)" }}>
        Match at the frequency of who you actually are.
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="glass-glow rounded-full px-8 py-3 text-sm font-medium transition-all hover:scale-105"
          style={{ color: "var(--bio-pulse)" }}
        >
          Get Started
        </a>
      </div>
    </main>
  );
}
