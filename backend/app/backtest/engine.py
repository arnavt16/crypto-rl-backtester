"""
Backtest engine: runs a trained agent deterministically over a held-out
test period, plus a buy-and-hold baseline over the same period, and
computes standard performance metrics.

Everything here operates on data the agent never trained on (the walk-
forward test split) -- that's what makes the resulting numbers meaningful
rather than an in-sample curve-fit.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.env.trading_env import EnvConfig, TradingEnv

TRADING_DAYS_PER_YEAR = 365  # crypto trades every day, not just weekdays


def run_agent_episode(agent, test_df: pd.DataFrame, env_config: EnvConfig) -> dict:
    env = TradingEnv(test_df, env_config)
    obs, _ = env.reset()

    trade_log = []
    equity_curve = [{"date": test_df.iloc[0]["date"], "equity": 1.0, "position": 0.0}]

    done = False
    while not done:
        action = agent.act(obs, greedy=True)
        obs, reward, terminated, truncated, info = env.step(action)
        done = terminated or truncated

        equity_curve.append(
            {"date": info["date"], "equity": info["equity"], "position": info["position"]}
        )
        if info["traded"]:
            trade_log.append(
                {
                    "date": info["date"],
                    "from_position": info["prev_position"],
                    "to_position": info["position"],
                    "price": info["close"],
                    "pnl_step": info["pnl"],
                    "friction": info["friction"],
                }
            )

    return {"equity_curve": equity_curve, "trade_log": trade_log}


def buy_and_hold_curve(test_df: pd.DataFrame) -> list[dict]:
    closes = test_df["close"].to_numpy()
    dates = test_df["date"].to_numpy()
    base = closes[0]
    return [
        {"date": str(d), "equity": float(c / base), "position": 1.0}
        for d, c in zip(dates, closes)
    ]


def compute_metrics(equity_curve: list[dict]) -> dict:
    equities = np.array([pt["equity"] for pt in equity_curve])
    daily_returns = np.diff(equities) / equities[:-1]

    total_return = float(equities[-1] / equities[0] - 1)

    n_days = len(equities) - 1
    if n_days > 0 and equities[-1] > 0:
        cagr = float((equities[-1] / equities[0]) ** (TRADING_DAYS_PER_YEAR / n_days) - 1)
    else:
        cagr = float("nan")

    ret_std = daily_returns.std()
    sharpe = (
        float(daily_returns.mean() / ret_std * np.sqrt(TRADING_DAYS_PER_YEAR))
        if ret_std > 1e-12
        else 0.0
    )

    running_max = np.maximum.accumulate(equities)
    drawdown = equities / running_max - 1
    max_drawdown = float(drawdown.min())

    wins = daily_returns[daily_returns > 0]
    win_rate = float(len(wins) / len(daily_returns)) if len(daily_returns) else 0.0

    return {
        "total_return": total_return,
        "cagr": cagr,
        "sharpe_ratio": sharpe,
        "max_drawdown": max_drawdown,
        "win_rate": win_rate,
        "n_days": int(n_days),
    }


def backtest_agent(agent, test_df: pd.DataFrame, env_config: EnvConfig) -> dict:
    agent_result = run_agent_episode(agent, test_df, env_config)
    bh_curve = buy_and_hold_curve(test_df)

    return {
        "agent": {
            "equity_curve": agent_result["equity_curve"],
            "trade_log": agent_result["trade_log"],
            "metrics": compute_metrics(agent_result["equity_curve"]),
        },
        "buy_and_hold": {
            "equity_curve": bh_curve,
            "metrics": compute_metrics(bh_curve),
        },
    }
