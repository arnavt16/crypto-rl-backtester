export interface EquityPoint {
  date: string;
  equity: number;
  position: number;
}

export interface TradeLogEntry {
  date: string;
  from_position: number;
  to_position: number;
  price: number;
  pnl_step: number;
  friction: number;
}

export interface Metrics {
  total_return: number;
  cagr: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  n_days: number;
}

export interface TrainingCurvePoint {
  episode: number;
  total_reward: number;
  epsilon: number;
}

export interface AgentRunResult {
  label?: string;
  equity_curve: EquityPoint[];
  trade_log: TradeLogEntry[];
  metrics: Metrics;
  training_curve?: TrainingCurvePoint[] | null;
}

export interface BuyAndHoldResult {
  equity_curve: EquityPoint[];
  metrics: Metrics;
}

export interface BaselineResponse {
  generated_at: string;
  split_date: string;
  train_range: [string, string];
  test_range: [string, string];
  env_config: { transaction_cost: number; risk_aversion: number };
  agents: {
    q_learning: AgentRunResult;
    ppo: AgentRunResult;
  };
  buy_and_hold: BuyAndHoldResult;
}

export type AgentType = "q_learning" | "ppo";

export interface TrainParams {
  agent_type: AgentType;
  transaction_cost: number;
  risk_aversion: number;
  training_amount: number;
}

export interface JobStatus {
  id: string;
  status: "pending" | "running" | "done" | "error";
  progress: number;
  error?: string | null;
}

export interface JobResult extends AgentRunResult {
  agent_type: AgentType;
  params: TrainParams;
  buy_and_hold: BuyAndHoldResult;
}

export interface MetaResponse {
  asset: string;
  source: string;
  train_range: [string, string];
  test_range: [string, string];
  n_train_days: number;
  n_test_days: number;
  feature_columns: string[];
}
