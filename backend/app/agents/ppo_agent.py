"""
PPO agent via Stable-Baselines3.

Unlike the tabular Q-learning agent, PPO consumes the FULL continuous
9-dimensional feature vector (+ position) directly -- no hand-picked
discretization needed. That's the actual point of comparison this project
makes: a from-scratch tabular baseline that needs manual feature
selection/binning, vs. a deep-RL agent that learns directly from the raw
engineered feature vector.
"""
from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import VecNormalize

from app.env.trading_env import EnvConfig, TradingEnv

warnings.filterwarnings("ignore", category=UserWarning)


@dataclass
class PPOTrainConfig:
    transaction_cost: float = 0.001
    risk_aversion: float = 0.0
    total_timesteps: int = 20_000
    n_steps: int = 512
    batch_size: int = 64
    learning_rate: float = 3e-4
    seed: int = 0


class PPOAgentWrapper:
    """Thin wrapper so PPO exposes the same .act(obs) interface the
    backtester uses for the Q-learning agent.

    Training uses VecNormalize (standard SB3 practice -- raw rewards here
    are tiny fractions like 0.001-0.05, which makes for a weak PPO gradient
    signal without normalization). The fitted observation running
    mean/variance is frozen after training and must be reapplied at
    inference time, or the policy sees an out-of-distribution input scale.
    """

    def __init__(self, model: PPO, vecnormalize: VecNormalize):
        self.model = model
        self.vecnormalize = vecnormalize

    def act(self, obs: np.ndarray, greedy: bool = True) -> int:
        norm_obs = self.vecnormalize.normalize_obs(obs.reshape(1, -1))
        action, _ = self.model.predict(norm_obs, deterministic=greedy)
        return int(action[0]) if hasattr(action, "__len__") else int(action)

    def save(self, path: str) -> None:
        self.model.save(path)
        self.vecnormalize.save(path.rsplit(".", 1)[0] + "_vecnormalize.pkl")

    @classmethod
    def load(cls, path: str, train_df, env_config: EnvConfig) -> "PPOAgentWrapper":
        model = PPO.load(path)
        vecnorm_path = path.rsplit(".", 1)[0] + "_vecnormalize.pkl"
        dummy_env = make_vec_env(lambda: Monitor(TradingEnv(train_df, env_config)), n_envs=1)
        vecnormalize = VecNormalize.load(vecnorm_path, dummy_env)
        vecnormalize.training = False
        vecnormalize.norm_reward = False
        return cls(model, vecnormalize)


def train_ppo(
    train_df: pd.DataFrame, config: PPOTrainConfig, progress_cb=None
) -> PPOAgentWrapper:
    env_config = EnvConfig(
        transaction_cost=config.transaction_cost, risk_aversion=config.risk_aversion
    )

    def _make():
        env = TradingEnv(train_df, env_config)
        return Monitor(env)

    raw_vec_env = make_vec_env(_make, n_envs=1, seed=config.seed)
    vec_env = VecNormalize(raw_vec_env, norm_obs=True, norm_reward=True, clip_obs=10.0)

    model = PPO(
        "MlpPolicy",
        vec_env,
        n_steps=config.n_steps,
        batch_size=config.batch_size,
        learning_rate=config.learning_rate,
        gamma=0.97,
        seed=config.seed,
        verbose=0,
        policy_kwargs=dict(net_arch=[64, 64]),
    )

    if progress_cb:
        from stable_baselines3.common.callbacks import BaseCallback

        class _CB(BaseCallback):
            def _on_step(self) -> bool:
                progress_cb(self.num_timesteps / config.total_timesteps, None)
                return True

        model.learn(total_timesteps=config.total_timesteps, callback=_CB())
    else:
        model.learn(total_timesteps=config.total_timesteps)

    vec_env.training = False
    vec_env.norm_reward = False
    return PPOAgentWrapper(model, vec_env)
