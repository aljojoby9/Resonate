export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-[var(--depth-abyss)]">
            {/* Bottom nav will go here */}
            {children}
        </div>
    );
}
