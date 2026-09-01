import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, GitCompare, LayoutGrid } from "lucide-react";
import { EquityCurveChart, type EquitySeries } from "./components/EquityCurveChart";
import { MetricsCards } from "./components/MetricsCards";
import { TradeLogTable } from "./components/TradeLogTable";
import { ControlsPanel } from "./components/ControlsPanel";
import { ComparisonMetricsTable } from "./components/ComparisonMetricsTable";
import { ThemeToggle } from "./components/ThemeToggle";
import { api, pollJob } from "./lib/api";
import { usePalette } from "./lib/palette";
import type {
  AgentRunResult,
  BaselineResponse,
  BuyAndHoldResult,
  MetaResponse,
  TrainParams,
} from "./types";

const AGENT_LABELS: Record<string, string> = {
  q_learning: "Tabular Q-Learning",
  ppo: "PPO (Stable-Baselines3)",
};

type ViewMode = "single" | "compare";

function App() {
  const pal = usePalette();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [baseline, setBaseline] = useState<BaselineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("single");

  const [params, setParams] = useState<TrainParams>({
    agent_type: "q_learning",
    transaction_cost: 0.001,
    risk_aversion: 0.05,
    training_amount: 60,
  });

  const [liveResult, setLiveResult] = useState<AgentRunResult | null>(null);
  const [liveBaseline, setLiveBaseline] = useState<BuyAndHoldResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    api.meta().then(setMeta).catch((e) => setError(String(e)));
    api.baseline().then(setBaseline).catch((e) => setError(String(e)));
  }, []);

  const displayed = useMemo(() => {
    if (liveResult && liveBaseline) {
      return { agent: liveResult, baseline: liveBaseline, isLive: true };
    }
    if (baseline) {
      return {
        agent: baseline.agents[params.agent_type],
        baseline: baseline.buy_and_hold,
        isLive: false,
      };
    }
    return null;
  }, [liveResult, liveBaseline, baseline, params.agent_type]);

  async function handleRun() {
    setRunning(true);
    setProgress(0);
    setError(null);
    setLiveResult(null);
    setLiveBaseline(null);
    try {
      const { job_id } = await api.startTrain(params);
      const result = await pollJob(job_id, (s) => setProgress(s.progress));
      setLiveResult(result);
      setLiveBaseline(result.buy_and_hold);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  function handleParamsChange(next: TrainParams) {
    setParams(next);
    setLiveResult(null);
    setLiveBaseline(null);
  }

  const singleSeries: EquitySeries[] | null = displayed
    ? [
        {
          key: "agent",
          label: AGENT_LABELS[params.agent_type],
          color: pal.agent,
          data: displayed.agent.equity_curve,
        },
        {
          key: "baseline",
          label: "Buy & Hold",
          color: pal.baseline,
          data: displayed.baseline.equity_curve,
        },
      ]
    : null;

  const compareSeries: EquitySeries[] | null = baseline
    ? [
        {
          key: "q_learning",
          label: AGENT_LABELS.q_learning,
          color: pal.agent,
          data: baseline.agents.q_learning.equity_curve,
        },
        {
          key: "ppo",
          label: AGENT_LABELS.ppo,
          color: pal.agent2,
          data: baseline.agents.ppo.equity_curve,
        },
        {
          key: "baseline",
          label: "Buy & Hold",
          color: pal.baseline,
          data: baseline.buy_and_hold.equity_curve,
        },
      ]
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "var(--series-agent)" }}
            >
              <TrendingUp size={16} color="#fff" />
            </span>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              RL Crypto Trading Bot Backtester
            </h1>
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Tabular Q-learning and PPO agents, walk-forward evaluated on held-out
            BTC-USD data they never trained on.
          </p>
          {meta && (
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {meta.asset} · train {meta.train_range[0]} → {meta.train_range[1]} (
              {meta.n_train_days} days) · test {meta.test_range[0]} → {meta.test_range[1]} (
              {meta.n_test_days} days, held out) · source: {meta.source}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
        </div>
      </motion.header>

      {error && (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          {error}
        </div>
      )}

      <div className="mb-4 inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        {(
          [
            { mode: "single" as ViewMode, icon: LayoutGrid, label: "Single agent" },
            { mode: "compare" as ViewMode, icon: GitCompare, label: "Compare both" },
          ]
        ).map((opt) => {
          const Icon = opt.icon;
          const active = viewMode === opt.mode;
          return (
            <button
              key={opt.mode}
              onClick={() => setViewMode(opt.mode)}
              className="relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: active ? "var(--series-agent)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
              }}
            >
              <Icon size={13} />
              {opt.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {viewMode === "single" ? (
          <motion.div
            key="single"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]"
          >
            <div className="lg:sticky lg:top-6 lg:self-start">
              <ControlsPanel
                params={params}
                onChange={handleParamsChange}
                onRun={handleRun}
                running={running}
                progress={progress}
              />
            </div>

            <div className="space-y-4">
              {displayed && singleSeries ? (
                <>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span
                      className="rounded-full px-2 py-0.5 font-medium"
                      style={{
                        background: displayed.isLive ? "var(--series-agent)" : "var(--grid)",
                        color: displayed.isLive ? "#fff" : "var(--text-secondary)",
                      }}
                    >
                      {displayed.isLive ? "Custom run" : "Pinned default result"}
                    </span>
                    {!displayed.isLive && (
                      <span>
                        txn cost {(baseline!.env_config.transaction_cost * 100).toFixed(2)}%, risk
                        aversion {baseline!.env_config.risk_aversion.toFixed(2)} — generated{" "}
                        {new Date(baseline!.generated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <MetricsCards
                    agentMetrics={displayed.agent.metrics}
                    baselineMetrics={displayed.baseline.metrics}
                    agentLabel={AGENT_LABELS[params.agent_type]}
                  />

                  <EquityCurveChart series={singleSeries} primaryAreaKey="agent" />

                  <TradeLogTable trades={displayed.agent.trade_log} />
                </>
              ) : (
                <LoadingPanel />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="compare"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {baseline && compareSeries ? (
              <>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Both agents shown here are the pinned default runs (same transaction cost
                  and risk-aversion settings), so the comparison is apples-to-apples. Switch to
                  Single agent to retrain with custom parameters.
                </p>
                <EquityCurveChart series={compareSeries} />
                <ComparisonMetricsTable
                  columns={[
                    { label: "Buy & Hold", metrics: baseline.buy_and_hold.metrics, color: pal.baseline },
                    {
                      label: AGENT_LABELS.q_learning,
                      metrics: baseline.agents.q_learning.metrics,
                      color: pal.agent,
                    },
                    { label: AGENT_LABELS.ppo, metrics: baseline.agents.ppo.metrics, color: pal.agent2 },
                  ]}
                />
              </>
            ) : (
              <LoadingPanel />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <footer
        className="mt-8 border-t pt-4 text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        Backtest only — not investment advice. Results reflect a single
        historical test period (2021 BTC-USD) and a single training seed; see
        the README's Methodology &amp; Limitations section before drawing
        conclusions from these numbers.
      </footer>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="card-surface animate-pulse rounded-lg p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
      Loading baseline results…
    </div>
  );
}

export default App;
