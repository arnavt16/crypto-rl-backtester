"""
Trains both agents for real (not a placeholder/fake demo) and writes:
  - backend/results/default.json   (equity curves, trade logs, metrics -- what the API serves instantly)
  - backend/models/q_learning.json (small, checked into git)
  - backend/models/ppo.zip         (regenerate locally; gitignored, ~MBs)

Run: (from backend/, with venv active) python scripts/generate_default_results.py
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd

from app.agents.ppo_agent import PPOTrainConfig, train_ppo
from app.agents.q_learning import QLearningAgent, QLearningConfig
from app.backtest.engine import backtest_agent
from app.data.features import FEATURE_COLUMNS, build_features, train_test_split_by_date
from app.env.trading_env import EnvConfig, TradingEnv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
SPLIT_DATE = "2021-01-01"

DEFAULT_TRANSACTION_COST = 0.001
DEFAULT_RISK_AVERSION = 0.05
Q_EPISODES = 150
PPO_TIMESTEPS = 100_000


def main() -> None:
    df = pd.read_csv(REPO_ROOT / "data" / "btc_daily.csv")
    feat = build_features(df)
    train, test = train_test_split_by_date(feat, SPLIT_DATE)
    print(f"train: {len(train)} rows ({train['date'].min()} -> {train['date'].max()})")
    print(f"test:  {len(test)} rows ({test['date'].min()} -> {test['date'].max()})")

    env_config = EnvConfig(
        transaction_cost=DEFAULT_TRANSACTION_COST, risk_aversion=DEFAULT_RISK_AVERSION
    )

    results = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "split_date": SPLIT_DATE,
        "train_range": [str(train["date"].min()), str(train["date"].max())],
        "test_range": [str(test["date"].min()), str(test["date"].max())],
        "env_config": {
            "transaction_cost": DEFAULT_TRANSACTION_COST,
            "risk_aversion": DEFAULT_RISK_AVERSION,
        },
        "agents": {},
    }

    # ---- Q-learning ----
    print("\n=== training Q-learning ===")
    t0 = time.time()
    q_env = TradingEnv(train, env_config)
    q_agent = QLearningAgent(
        QLearningConfig(episodes=Q_EPISODES, epsilon_decay_episodes=int(Q_EPISODES * 0.7))
    )
    q_agent.fit_bins(train[FEATURE_COLUMNS].to_numpy())
    _last_pct = [-1]

    def _q_progress(p, r):
        pct = int(p * 100)
        if pct != _last_pct[0] and pct % 10 == 0:
            _last_pct[0] = pct
            print(f"  {pct}%  episode_reward={r:.4f}")

    q_agent.train(q_env, progress_cb=_q_progress)
    print(f"Q-learning trained in {time.time() - t0:.1f}s")

    models_dir = BACKEND_DIR / "models"
    models_dir.mkdir(exist_ok=True)
    q_agent.save(str(models_dir / "q_learning.json"))

    q_backtest = backtest_agent(q_agent, test, env_config)
    results["agents"]["q_learning"] = {
        "label": "Tabular Q-Learning",
        "training_curve": [tc.__dict__ for tc in q_agent.training_curve],
        **q_backtest["agent"],
    }

    # ---- PPO ----
    print("\n=== training PPO ===")
    t0 = time.time()
    _last_ppo_pct = [-1]

    def _ppo_progress(p, r):
        pct = int(p * 100)
        if pct != _last_ppo_pct[0] and pct % 10 == 0:
            _last_ppo_pct[0] = pct
            print(f"  {pct}%")

    ppo_agent = train_ppo(
        train,
        PPOTrainConfig(
            transaction_cost=DEFAULT_TRANSACTION_COST,
            risk_aversion=DEFAULT_RISK_AVERSION,
            total_timesteps=PPO_TIMESTEPS,
        ),
        progress_cb=_ppo_progress,
    )
    print(f"PPO trained in {time.time() - t0:.1f}s")
    ppo_agent.save(str(models_dir / "ppo.zip"))

    ppo_backtest = backtest_agent(ppo_agent, test, env_config)
    results["agents"]["ppo"] = {
        "label": "PPO (Stable-Baselines3)",
        **ppo_backtest["agent"],
    }

    # buy & hold is identical regardless of agent -- store once
    results["buy_and_hold"] = q_backtest["buy_and_hold"]

    results_dir = BACKEND_DIR / "results"
    results_dir.mkdir(exist_ok=True)
    out_path = results_dir / "default.json"
    out_path.write_text(json.dumps(results, indent=2))
    print(f"\nSaved -> {out_path}")

    for name, a in results["agents"].items():
        m = a["metrics"]
        print(
            f"{name:12s} total_return={m['total_return']:+.2%} sharpe={m['sharpe_ratio']:.2f} "
            f"max_dd={m['max_drawdown']:.2%} trades={len(a.get('trade_log', []))}"
        )
    bh = results["buy_and_hold"]["metrics"]
    print(
        f"{'buy_and_hold':12s} total_return={bh['total_return']:+.2%} sharpe={bh['sharpe_ratio']:.2f} "
        f"max_dd={bh['max_drawdown']:.2%}"
    )


if __name__ == "__main__":
    main()
