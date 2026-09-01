import { motion } from "framer-motion";
import type { Metrics } from "../types";
import { usePalette } from "../lib/palette";
import { STATS, isBetter } from "../lib/metricDefs";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  agentMetrics: Metrics;
  baselineMetrics: Metrics;
  agentLabel: string;
}

export function MetricsCards({ agentMetrics, baselineMetrics, agentLabel }: Props) {
  const pal = usePalette();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STATS.map((stat, i) => {
        const agentVal = agentMetrics[stat.key] as number;
        const baseVal = baselineMetrics[stat.key] as number;
        const better = isBetter(agentVal, baseVal, stat.direction);

        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="card-surface rounded-lg p-3"
          >
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </div>
            <div
              className="tabular-nums mt-1 text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              <AnimatedNumber value={agentVal} format={stat.format} />
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
          </motion.div>
        );
      })}
    </div>
  );
}
