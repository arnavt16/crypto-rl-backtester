"""
Tabular Q-learning agent, implemented from scratch (numpy only, no RL
framework). This is the "fundamentals" baseline agent for the project.

Tabular methods can't consume a 9-dimensional continuous observation
directly (the state space would be uncountable), so this agent hand-picks
3 indicators to discretize into quantile bins, plus current position:

    trend      <- sma_10_ratio   (3 bins: down / flat / up)
    momentum   <- rsi_14         (3 bins: oversold / neutral / overbought)
    volatility <- volatility_10d (3 bins: low / medium / high)
    position   <- {-1, 0, 1}     (3 states)

    => 3 * 3 * 3 * 3 = 81 discrete states, 3 actions -> a 81x3 Q-table.

Bin edges are fit ONLY on the training split's quantiles and then reused
unchanged on the test split, so no test-set information leaks into the
discretization.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

import numpy as np

from app.data.features import FEATURE_COLUMNS

TREND_IDX = FEATURE_COLUMNS.index("sma_10_ratio")
MOMENTUM_IDX = FEATURE_COLUMNS.index("rsi_14")
VOL_IDX = FEATURE_COLUMNS.index("volatility_10d")
N_BINS = 3
N_ACTIONS = 3


@dataclass
class QLearningConfig:
    alpha: float = 0.1
    gamma: float = 0.97
    epsilon_start: float = 1.0
    epsilon_end: float = 0.05
    epsilon_decay_episodes: int = 40
    episodes: int = 60
    seed: int = 0


@dataclass
class TrainingCurvePoint:
    episode: int
    total_reward: float
    epsilon: float


class QLearningAgent:
    def __init__(self, config: QLearningConfig | None = None):
        self.config = config or QLearningConfig()
        self.bin_edges: dict[str, np.ndarray] | None = None
        self.q_table = np.zeros((N_BINS, N_BINS, N_BINS, N_BINS, N_ACTIONS), dtype=np.float64)
        self.rng = np.random.default_rng(self.config.seed)
        self.training_curve: list[TrainingCurvePoint] = []

    # ---- discretization -------------------------------------------------
    def fit_bins(self, train_features: np.ndarray) -> None:
        def edges(col_idx: int) -> np.ndarray:
            vals = train_features[:, col_idx]
            qs = np.quantile(vals, [1 / 3, 2 / 3])
            return qs

        self.bin_edges = {
            "trend": edges(TREND_IDX),
            "momentum": edges(MOMENTUM_IDX),
            "volatility": edges(VOL_IDX),
        }

    def _discretize(self, obs: np.ndarray) -> tuple[int, int, int, int]:
        assert self.bin_edges is not None, "call fit_bins() first"
        trend_bin = int(np.digitize(obs[TREND_IDX], self.bin_edges["trend"]))
        mom_bin = int(np.digitize(obs[MOMENTUM_IDX], self.bin_edges["momentum"]))
        vol_bin = int(np.digitize(obs[VOL_IDX], self.bin_edges["volatility"]))
        position = obs[-1]  # last obs element is current position in {-1,0,1}
        pos_bin = int(round(position)) + 1  # -> {0,1,2}
        return trend_bin, mom_bin, vol_bin, pos_bin

    # ---- policy -----------------------------------------------------------
    def act(self, obs: np.ndarray, greedy: bool = True, epsilon: float = 0.0) -> int:
        state = self._discretize(obs)
        if not greedy and self.rng.random() < epsilon:
            return int(self.rng.integers(0, N_ACTIONS))
        return int(np.argmax(self.q_table[state]))

    # ---- training -----------------------------------------------------
    def train(self, env, progress_cb=None) -> None:
        cfg = self.config
        for ep in range(cfg.episodes):
            frac = min(1.0, ep / max(1, cfg.epsilon_decay_episodes))
            epsilon = cfg.epsilon_start + frac * (cfg.epsilon_end - cfg.epsilon_start)

            obs, _ = env.reset()
            state = self._discretize(obs)
            done = False
            total_reward = 0.0
            while not done:
                action = self.act(obs, greedy=False, epsilon=epsilon)
                next_obs, reward, terminated, truncated, info = env.step(action)
                done = terminated or truncated
                next_state = self._discretize(next_obs) if not done else state

                best_next = np.max(self.q_table[next_state])
                td_target = reward + cfg.gamma * best_next * (0.0 if done else 1.0)
                td_error = td_target - self.q_table[state][action]
                self.q_table[state][action] += cfg.alpha * td_error

                state = next_state
                obs = next_obs
                total_reward += reward

            self.training_curve.append(TrainingCurvePoint(ep, total_reward, epsilon))
            if progress_cb:
                progress_cb((ep + 1) / cfg.episodes, total_reward)

    # ---- persistence -----------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "config": self.config.__dict__,
            "bin_edges": {k: v.tolist() for k, v in self.bin_edges.items()},
            "q_table": self.q_table.tolist(),
            "training_curve": [tc.__dict__ for tc in self.training_curve],
        }

    def save(self, path: str) -> None:
        with open(path, "w") as f:
            json.dump(self.to_dict(), f)

    @classmethod
    def load(cls, path: str) -> "QLearningAgent":
        with open(path) as f:
            d = json.load(f)
        agent = cls(QLearningConfig(**d["config"]))
        agent.bin_edges = {k: np.array(v) for k, v in d["bin_edges"].items()}
        agent.q_table = np.array(d["q_table"])
        agent.training_curve = [TrainingCurvePoint(**tc) for tc in d["training_curve"]]
        return agent
