import type { Metrics } from "../types";

export type Direction = "higher-better" | "closer-to-zero-better";

export interface StatDef {
  key: keyof Metrics;
  label: string;
  format: (v: number) => string;
  direction: Direction;
}

export const STATS: StatDef[] = [
  {
    key: "total_return",
    label: "Total Return",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    direction: "higher-better",
  },
  {
    key: "sharpe_ratio",
    label: "Sharpe Ratio",
    format: (v) => v.toFixed(2),
    direction: "higher-better",
  },
  {
    key: "max_drawdown",
    label: "Max Drawdown",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    direction: "closer-to-zero-better",
  },
  {
    key: "win_rate",
    label: "Win Rate (days)",
    format: (v) => `${(v * 100).toFixed(1)}%`,
    direction: "higher-better",
  },
];

export function isBetter(a: number, b: number, dir: Direction): boolean {
  if (dir === "higher-better") return a > b;
  return Math.abs(a) < Math.abs(b);
}

/** Returns the index of the best value among candidates for a given metric direction. */
export function bestIndex(values: number[], dir: Direction): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (isBetter(values[i], values[best], dir)) best = i;
  }
  return best;
}
