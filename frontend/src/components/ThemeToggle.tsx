import { Moon, Sun, Monitor } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme, type ThemeMode } from "../lib/theme";

const OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: "light", icon: Sun, label: "Light theme" },
  { mode: "dark", icon: Moon, label: "Dark theme" },
  { mode: "system", icon: Monitor, label: "Match system theme" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div
      className="relative inline-flex items-center gap-0.5 rounded-full border p-0.5"
      style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.mode;
        return (
          <button
            key={opt.mode}
            aria-label={opt.label}
            onClick={() => setMode(opt.mode)}
            className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full"
          >
            {active && (
              <motion.div
                layoutId="theme-toggle-active"
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--series-agent)" }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <Icon
              size={13}
              className="relative"
              style={{ color: active ? "#fff" : "var(--text-muted)" }}
            />
          </button>
        );
      })}
    </div>
  );
}
