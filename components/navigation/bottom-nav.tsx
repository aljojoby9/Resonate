"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
    Compass,
    MessageCircle,
    Settings,
    User,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{ href: Route; icon: LucideIcon; label: string }> = [
    { href: "/discover", icon: Compass, label: "Discover" },
    { href: "/matches", icon: MessageCircle, label: "Matches" },
    { href: "/profile", icon: User, label: "Profile" },
    { href: "/frequency", icon: Zap, label: "Frequency" },
    { href: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-50 mx-auto flex max-w-md items-center justify-around border-t border-bio-pulse/10 bg-depth-trench/80 px-4 py-3 backdrop-blur-glass"
            aria-label="Primary navigation"
        >
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const active = pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        aria-label={label}
                        className={cn(
                            "flex flex-col items-center gap-1 rounded-xl p-2 transition-all duration-300",
                            active
                                ? "text-bio-pulse drop-shadow-[0_0_8px_rgba(74,247,196,0.6)]"
                                : "text-white/30 hover:text-white/60"
                        )}
                    >
                        <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                    </Link>
                );
            })}
        </nav>
    );
}
