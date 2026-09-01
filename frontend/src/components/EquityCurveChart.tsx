import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "../types";
import { usePalette } from "../lib/palette";

export interface EquitySeries {
  key: string;
  label: string;
  color: string;
  data: EquityPoint[];
}

interface Props {
  series: EquitySeries[];
  /** key of the series to render with a soft gradient fill underneath (single-agent view only) */
  primaryAreaKey?: string;
}

interface MergedPoint {
  date: string;
  [seriesKey: string]: string | number;
}

function mergeCurves(series: EquitySeries[]): MergedPoint[] {
  if (series.length === 0) return [];
  const maps = series.map((s) => new Map(s.data.map((p) => [p.date, p.equity])));
  const dates = series[0].data.map((p) => p.date);
  return dates.map((date) => {
    const point: MergedPoint = { date };
    series.forEach((s, si) => {
      point[s.key] = maps[si].get(date) ?? NaN;
    });
    return point;
  });
}

function formatPct(v: number): string {
  return `${((v - 1) * 100).toFixed(1)}%`;
}

export function EquityCurveChart({ series, primaryAreaKey }: Props) {
  const pal = usePalette();
  const data = mergeCurves(series);
  const tickInterval = Math.max(1, Math.floor(data.length / 6));
  const labelByKey = Object.fromEntries(series.map((s) => [s.key, s.label]));

  return (
    <div className="card-surface rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Equity Curve (test period, indexed to 1.0)
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
          <defs>
            {series.map(
              (s) =>
                s.key === primaryAreaKey && (
                  <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                )
            )}
          </defs>
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
            formatter={(value, name) => [formatPct(Number(value)), labelByKey[String(name)] ?? name]}
          />
          {series.length > 1 && (
            <Legend
              formatter={(value) => (
                <span style={{ color: pal.textSecondary, fontSize: 12 }}>
                  {labelByKey[value] ?? value}
                </span>
              )}
            />
          )}
          {series.map((s) =>
            s.key === primaryAreaKey ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke="none"
                fill={`url(#fill-${s.key})`}
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
                tooltipType="none"
              />
            ) : null
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
