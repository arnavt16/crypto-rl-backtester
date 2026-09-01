import { useTheme } from "./theme";

export interface Palette {
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  baselineAxis: string;
  agent: string;
  agent2: string;
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
    agent: "#2a78d6", // categorical slot 1 (blue) -- primary agent
    agent2: "#1baf7a", // categorical slot 3 (aqua) -- second agent, compare mode
    baseline: "#eb6834", // categorical slot 2 (orange) -- buy & hold
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
    agent2: "#199e70",
    baseline: "#d95926",
    good: "#0ca30c",
    critical: "#e66767",
  },
};

export function usePalette(): Palette {
  const { isDark } = useTheme();
  return isDark ? palettes.dark : palettes.light;
}
