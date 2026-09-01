import type { Metrics } from "../types";
import { STATS, bestIndex } from "../lib/metricDefs";
import { usePalette } from "../lib/palette";

interface Column {
  label: string;
  metrics: Metrics;
  color?: string;
}

interface Props {
  columns: Column[];
}

export function ComparisonMetricsTable({ columns }: Props) {
  const pal = usePalette();

  return (
    <div className="card-surface overflow-x-auto rounded-lg">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--border)" }}>
            <th className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Metric
            </th>
            {columns.map((c) => (
              <th key={c.label} className="px-4 py-3 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  {c.color && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: c.color }}
                    />
                  )}
                  <span style={{ color: "var(--text-primary)" }}>{c.label}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STATS.map((stat) => {
            const values = columns.map((c) => c.metrics[stat.key] as number);
            const winner = bestIndex(values, stat.direction);
            return (
              <tr key={stat.key} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </td>
                {values.map((v, i) => (
                  <td
                    key={i}
                    className="tabular-nums px-4 py-2.5 text-sm font-medium"
                    style={{ color: i === winner ? pal.good : "var(--text-secondary)" }}
                  >
                    {stat.format(v)}
                    {i === winner && <span className="ml-1 text-xs">★</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
