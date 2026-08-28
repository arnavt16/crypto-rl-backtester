import { useEffect, useMemo, useState } from "react";
import { EquityCurveChart } from "./components/EquityCurveChart";
import { MetricsCards } from "./components/MetricsCards";
import { TradeLogTable } from "./components/TradeLogTable";
import { ControlsPanel } from "./components/ControlsPanel";
import { api, pollJob } from "./lib/api";
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

function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [baseline, setBaseline] = useState<BaselineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Whichever run is currently on screen: a fresh custom run if present,
  // otherwise the pinned default result for the selected agent.
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
    // Switching agent/params without re-running falls back to the pinned
    // default for that agent rather than showing stale results.
    setLiveResult(null);
    setLiveBaseline(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          RL Crypto Trading Bot Backtester
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
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
      </header>

      {error && (
        <div
          className="mb-4 rounded-md border px-4 py-2 text-sm"
          style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
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
          {displayed ? (
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

              <EquityCurveChart
                agentCurve={displayed.agent.equity_curve}
                baselineCurve={displayed.baseline.equity_curve}
                agentLabel={AGENT_LABELS[params.agent_type]}
              />

              <TradeLogTable trades={displayed.agent.trade_log} />
            </>
          ) : (
            <div
              className="rounded-lg border p-8 text-center text-sm"
              style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Loading baseline results…
            </div>
          )}
        </div>
      </div>

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

export default App;
