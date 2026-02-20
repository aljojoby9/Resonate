import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

const config: Config = {
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                depth: {
                    abyss: "#04060f",
                    trench: "#080e1e",
                    midnight: "#0d1530",
                    dusk: "#151f3d",
                },
                bio: {
                    pulse: "#4af7c4",
                    match: "#c77dff",
                    spark: "#ff9f43",
                    deep: "#48cae4",
                },
                wave: {
                    1: "#4af7c4",
                    2: "#38e3ff",
                    3: "#9b72ff",
                    4: "#ff6eb4",
                    5: "#ff9f43",
                },
            },
            fontFamily: {
                display: ["Melodrama", ...defaultTheme.fontFamily.sans],
                sans: ["General Sans", ...defaultTheme.fontFamily.sans],
                mono: ["Fragment Mono", ...defaultTheme.fontFamily.mono],
            },
            boxShadow: {
                "glow-sm": "0 0 12px rgba(74, 247, 196, 0.25)",
                "glow-md": "0 0 30px rgba(74, 247, 196, 0.35)",
                "glow-lg": "0 0 60px rgba(74, 247, 196, 0.20)",
                "glow-match": "0 0 80px rgba(199, 125, 255, 0.45)",
            },
            backdropBlur: {
                glass: "24px",
            },
            animation: {
                waveform: "waveform 2.4s ease-in-out infinite",
                "pulse-glow": "pulseGlow 3s ease-in-out infinite",
                float: "float 6s ease-in-out infinite",
                frequency: "frequency 1.8s ease-in-out infinite alternate",
            },
            keyframes: {
                waveform: {
                    "0%, 100%": { transform: "scaleY(0.4)" },
                    "50%": { transform: "scaleY(1.0)" },
                },
                pulseGlow: {
                    "0%, 100%": {
                        boxShadow: "0 0 12px rgba(74,247,196,0.25)",
                    },
                    "50%": { boxShadow: "0 0 40px rgba(74,247,196,0.55)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-8px)" },
                },
                frequency: {
                    from: { transform: "scaleY(0.3) scaleX(1)" },
                    to: { transform: "scaleY(1.2) scaleX(0.95)" },
                },
            },
            transitionTimingFunction: {
                "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
                "in-expo": "cubic-bezier(0.7, 0, 0.84, 0)",
                spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            },
        },
    },
    plugins: [animate, typography],
};

export default config;
