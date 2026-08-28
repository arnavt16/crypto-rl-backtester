import { useEffect, useState } from "react";

export interface Palette {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  baselineAxis: string;
  agent: string;
  baseline: string;
  good: string;
  critical: string;
}

// Mirrors the CSS custom properties in index.css. Recharts needs literal
// color strings (SVG var() support is inconsistent), so we keep one JS
// source of truth in sync with the CSS one.
export const palettes: { light: Palette; dark: Palette } = {
  light: {
    surface: "#fcfcfb",
    textPrimary: "#0b0b0b",
    textSecondary: "#52514e",
    textMuted: "#898781",
    grid: "#e1e0d9",
    baselineAxis: "#c3c2b7",
    agent: "#2a78d6",
    baseline: "#eb6834",
    good: "#0ca30c",
    critical: "#d03b3b",
  },
  dark: {
    surface: "#1a1a19",
    textPrimary: "#ffffff",
    textSecondary: "#c3c2b7",
    textMuted: "#898781",
    grid: "#2c2c2a",
    baselineAxis: "#383835",
    agent: "#3987e5",
    baseline: "#d95926",
    good: "#0ca30c",
    critical: "#e66767",
  },
};

export function usePalette(): Palette {
  const [isDark, setIsDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isDark ? palettes.dark : palettes.light;
}
