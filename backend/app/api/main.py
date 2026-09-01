"""
FastAPI backend for the RL trading bot backtester.

Run (from backend/, venv active):
    uvicorn app.api.main:app --reload --port 8000
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agents.ppo_agent import PPOTrainConfig, train_ppo
from app.agents.q_learning import QLearningAgent, QLearningConfig
from app.backtest.engine import backtest_agent
from app.data.features import FEATURE_COLUMNS, build_features, train_test_split_by_date
from app.env.trading_env import EnvConfig
from app.jobs.manager import job_manager

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent
SPLIT_DATE = "2021-01-01"

app = FastAPI(title="Crypto RL Backtester API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_train_test() -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(REPO_ROOT / "data" / "btc_daily.csv")
    feat = build_features(df)
    return train_test_split_by_date(feat, SPLIT_DATE)


# ---------------------------------------------------------------- schemas --
class TrainRequest(BaseModel):
    agent_type: Literal["q_learning", "ppo"]
    transaction_cost: float = Field(0.001, ge=0.0, le=0.02)
    risk_aversion: float = Field(0.05, ge=0.0, le=1.0)
    training_amount: int = Field(
        60, ge=10, le=200, description="episodes for q_learning, x1000 timesteps for ppo"
    )


class JobStatus(BaseModel):
    id: str
    status: str
    progress: float
    error: str | None = None


# ------------------------------------------------------------------ routes --
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    train, test = get_train_test()
    return {
        "asset": "BTC-USD",
        "source": "skforecast-datasets (public daily OHLCV)",
        "train_range": [str(train["date"].min()), str(train["date"].max())],
        "test_range": [str(test["date"].min()), str(test["date"].max())],
        "n_train_days": len(train),
        "n_test_days": len(test),
        "feature_columns": FEATURE_COLUMNS,
    }


@app.get("/api/baseline")
def baseline():
    path = BACKEND_DIR / "results" / "default.json"
    if not path.exists():
        raise HTTPException(
            404, "No pinned baseline yet -- run scripts/generate_default_results.py"
        )
    return json.loads(path.read_text())


@app.post("/api/train")
def train(req: TrainRequest):
    train_df, test_df = get_train_test()
    env_config = EnvConfig(
        transaction_cost=req.transaction_cost, risk_aversion=req.risk_aversion
    )

    def _target(progress_cb):
        if req.agent_type == "q_learning":
            agent = QLearningAgent(
                QLearningConfig(
                    episodes=req.training_amount,
                    epsilon_decay_episodes=max(1, int(req.training_amount * 0.7)),
                )
            )
            agent.fit_bins(train_df[FEATURE_COLUMNS].to_numpy())

            from app.env.trading_env import TradingEnv

            env = TradingEnv(train_df, env_config)
            agent.train(env, progress_cb=lambda p, r: progress_cb(p))
            training_curve = [tc.__dict__ for tc in agent.training_curve]
        else:
            agent = train_ppo(
                train_df,
                PPOTrainConfig(
                    transaction_cost=req.transaction_cost,
                    risk_aversion=req.risk_aversion,
                    total_timesteps=req.training_amount * 1000,
                ),
                progress_cb=lambda p, r: progress_cb(p),
            )
            training_curve = None

        result = backtest_agent(agent, test_df, env_config)
        return {
            "agent_type": req.agent_type,
            "params": req.model_dump(),
            "training_curve": training_curve,
            **result["agent"],
            "buy_and_hold": result["buy_and_hold"],
        }

    job_id = job_manager.create(_target)
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> JobStatus:
    job = job_manager.get(job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    return JobStatus(id=job.id, status=job.status, progress=job.progress, error=job.error)


@app.get("/api/jobs/{job_id}/results")
def job_results(job_id: str):
    job = job_manager.get(job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    if job.status == "error":
        raise HTTPException(500, job.error)
    if job.status != "done":
        raise HTTPException(409, f"job not finished (status={job.status})")
    return job.result
