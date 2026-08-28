import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "../types";
import { usePalette } from "../lib/palette";

interface Props {
  agentCurve: EquityPoint[];
  baselineCurve: EquityPoint[];
  agentLabel: string;
}

interface MergedPoint {
  date: string;
  agent: number;
  baseline: number;
}

function mergeCurves(agent: EquityPoint[], baseline: EquityPoint[]): MergedPoint[] {
  const baselineByDate = new Map(baseline.map((p) => [p.date, p.equity]));
  return agent.map((p) => ({
    date: p.date,
    agent: p.equity,
    baseline: baselineByDate.get(p.date) ?? NaN,
  }));
}

function formatPct(v: number): string {
  return `${((v - 1) * 100).toFixed(1)}%`;
}

export function EquityCurveChart({ agentCurve, baselineCurve, agentLabel }: Props) {
  const pal = usePalette();
  const data = mergeCurves(agentCurve, baselineCurve);

  // Thin the x-axis ticks so labels don't collide.
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Equity Curve (test period, indexed to 1.0)
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={pal.grid} strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            interval={tickInterval}
            tick={{ fill: pal.textMuted, fontSize: 11 }}
            stroke={pal.baselineAxis}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatPct}
            tick={{ fill: pal.textMuted, fontSize: 11 }}
            stroke={pal.baselineAxis}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: pal.surface,
              border: `1px solid ${pal.grid}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: pal.textSecondary }}
            formatter={(value, name) => [
              formatPct(Number(value)),
              name === "agent" ? agentLabel : "Buy & Hold",
            ]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: pal.textSecondary, fontSize: 12 }}>
                {value === "agent" ? agentLabel : "Buy & Hold"}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="agent"
            stroke={pal.agent}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="baseline"
            stroke={pal.baseline}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
