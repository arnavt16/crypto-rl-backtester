import type { AgentType, TrainParams } from "../types";

interface Props {
  params: TrainParams;
  onChange: (params: TrainParams) => void;
  onRun: () => void;
  running: boolean;
  progress: number;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="tabular-nums font-medium" style={{ color: "var(--text-primary)" }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--series-agent)] disabled:opacity-50"
      />
    </label>
  );
}

export function ControlsPanel({ params, onChange, onRun, running, progress }: Props) {
  const isPpo = params.agent_type === "ppo";

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
    >
      <h3 className="mb-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Backtest Controls
      </h3>

      <div className="mb-4 flex gap-2">
        {(["q_learning", "ppo"] as AgentType[]).map((t) => (
          <button
            key={t}
            disabled={running}
            onClick={() => onChange({ ...params, agent_type: t })}
            className="flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            style={{
              borderColor: params.agent_type === t ? "var(--series-agent)" : "var(--border)",
              background: params.agent_type === t ? "var(--series-agent)" : "transparent",
              color: params.agent_type === t ? "#fff" : "var(--text-secondary)",
            }}
          >
            {t === "q_learning" ? "Tabular Q-Learning" : "PPO (Stable-Baselines3)"}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <Slider
          label="Transaction cost (per position change)"
          value={params.transaction_cost}
          min={0}
          max={0.01}
          step={0.0005}
          format={(v) => `${(v * 100).toFixed(2)}%`}
          onChange={(v) => onChange({ ...params, transaction_cost: v })}
          disabled={running}
        />
        <Slider
          label="Risk aversion (volatility penalty weight)"
          value={params.risk_aversion}
          min={0}
          max={0.5}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => onChange({ ...params, risk_aversion: v })}
          disabled={running}
        />
        <Slider
          label={isPpo ? "Training length (x1000 timesteps)" : "Training length (episodes)"}
          value={params.training_amount}
          min={10}
          max={200}
          step={10}
          format={(v) => (isPpo ? `${v * 1000}` : `${v}`)}
          onChange={(v) => onChange({ ...params, training_amount: v })}
          disabled={running}
        />
      </div>

      <button
        onClick={onRun}
        disabled={running}
        className="mt-5 w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
        style={{ background: "var(--series-agent)" }}
      >
        {running ? `Training… ${(progress * 100).toFixed(0)}%` : "Run Backtest"}
      </button>

      {running && (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--grid)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress * 100}%`, background: "var(--series-agent)" }}
          />
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Re-runs train on 2013–2020 data and evaluate on held-out 2021 data the
        agent never saw during training.
      </p>
    </div>
  );
}
