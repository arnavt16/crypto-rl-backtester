"""
Custom Gymnasium-compatible single-asset trading environment.

Design notes (documented here because they're the crux of whether this
project's results mean anything):

- Decision timing: at step i the agent sees features computed using data
  up through the close of day i, and chooses a TARGET POSITION to hold
  from close[i] to close[i+1]. The realized return for that holding period
  is close[i+1]/close[i] - 1, which is exactly what pandas' pct_change(1)
  stores at row i+1. So reward at transition i -> i+1 uses ret_1d[i+1].
  There is no peeking at i+1's price when the action is chosen.

- Actions: Discrete(3) -> target position in {-1 (short), 0 (flat), 1 (long)}.
  Position is not incremental ("buy more") -- it's a target the agent picks
  each step, which keeps the action space small and the Q-table tractable
  for the tabular agent.

- Reward = position * next-day return
           - transaction_cost * |position change|          (friction)
           - risk_aversion * position^2 * trailing volatility  (risk penalty)

  transaction_cost and risk_aversion are both constructor params, which is
  what the frontend's sliders end up controlling.
"""
from __future__ import annotations

from dataclasses import dataclass

import gymnasium as gym
import numpy as np
import pandas as pd
from gymnasium import spaces

from app.data.features import FEATURE_COLUMNS

POSITIONS = np.array([-1.0, 0.0, 1.0], dtype=np.float32)


@dataclass
class EnvConfig:
    transaction_cost: float = 0.001   # 10 bps per unit position change
    risk_aversion: float = 0.0        # weight on volatility penalty term
    allow_short: bool = True


class TradingEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, df: pd.DataFrame, config: EnvConfig | None = None):
        super().__init__()
        assert set(FEATURE_COLUMNS).issubset(df.columns), "df missing engineered features"
        assert "ret_1d" in df.columns and "close" in df.columns and "date" in df.columns

        self.df = df.reset_index(drop=True)
        self.config = config or EnvConfig()
        self.n_steps = len(self.df) - 1  # need i+1 to exist for reward
        assert self.n_steps > 10, "not enough rows for an episode"

        n_features = len(FEATURE_COLUMNS) + 1  # + current position
        self.observation_space = spaces.Box(
            low=-10.0, high=10.0, shape=(n_features,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(3)

        self._feat = self.df[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
        self._ret_next = self.df["ret_1d"].to_numpy(dtype=np.float32)
        self._close = self.df["close"].to_numpy(dtype=np.float32)
        self._vol = self.df["volatility_10d"].to_numpy(dtype=np.float32)
        self._dates = self.df["date"].astype(str).to_numpy()

        self._i = 0
        self._position = 0.0
        self._equity = 1.0

    def _obs(self) -> np.ndarray:
        return np.concatenate(
            [self._feat[self._i], np.array([self._position], dtype=np.float32)]
        )

    def reset(self, *, seed: int | None = None, options: dict | None = None):
        super().reset(seed=seed)
        self._i = 0
        self._position = 0.0
        self._equity = 1.0
        return self._obs(), {}

    def step(self, action: int):
        assert self.action_space.contains(action)
        target_position = float(POSITIONS[action])
        if not self.config.allow_short:
            target_position = max(target_position, 0.0)

        prev_position = self._position
        next_i = self._i + 1
        step_return = float(self._ret_next[next_i])
        trailing_vol = float(self._vol[self._i])

        pnl = target_position * step_return
        friction = self.config.transaction_cost * abs(target_position - prev_position)
        risk_penalty = self.config.risk_aversion * (target_position ** 2) * trailing_vol
        reward = pnl - friction - risk_penalty

        self._equity *= (1.0 + pnl - friction)
        self._position = target_position
        self._i = next_i

        terminated = self._i >= self.n_steps
        truncated = False

        info = {
            "date": str(self._dates[self._i]),
            "close": float(self._close[self._i]),
            "position": target_position,
            "prev_position": prev_position,
            "step_return": step_return,
            "pnl": pnl,
            "friction": friction,
            "risk_penalty": risk_penalty,
            "reward": reward,
            "equity": self._equity,
            "traded": target_position != prev_position,
        }

        obs = self._obs() if not terminated else np.zeros(
            self.observation_space.shape, dtype=np.float32
        )
        return obs, reward, terminated, truncated, info
