import type { Metrics } from "../types";
import { usePalette } from "../lib/palette";

interface Props {
  agentMetrics: Metrics;
  baselineMetrics: Metrics;
  agentLabel: string;
}

type Direction = "higher-better" | "closer-to-zero-better";

interface StatDef {
  key: keyof Metrics;
  label: string;
  format: (v: number) => string;
  direction: Direction;
}

const STATS: StatDef[] = [
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

function isBetter(agent: number, baseline: number, dir: Direction): boolean {
  if (dir === "higher-better") return agent > baseline;
  return Math.abs(agent) < Math.abs(baseline); // closer to zero
}

export function MetricsCards({ agentMetrics, baselineMetrics, agentLabel }: Props) {
  const pal = usePalette();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STATS.map((stat) => {
        const agentVal = agentMetrics[stat.key] as number;
        const baseVal = baselineMetrics[stat.key] as number;
        const better = isBetter(agentVal, baseVal, stat.direction);

        return (
          <div
            key={stat.key}
            className="rounded-lg border p-3"
            style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
          >
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </div>
            <div
              className="tabular-nums mt-1 text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {stat.format(agentVal)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span style={{ color: pal.textMuted }}>{agentLabel} vs B&H</span>
              <span
                className="tabular-nums font-medium"
                style={{ color: better ? pal.good : pal.critical }}
              >
                {better ? "↑" : "↓"} {stat.format(baseVal)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
