"""
Minimal in-memory background job runner.

This is intentionally simple (a dict + Python threads, no Celery/Redis) --
appropriate for a single-process portfolio-project demo, not a claim that
it's production job infrastructure. Documented as a known simplification
in the README.
"""
from __future__ import annotations

import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Job:
    id: str
    status: str = "pending"  # pending | running | done | error
    progress: float = 0.0
    result: Any = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)


class JobManager:
    def __init__(self):
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self, target: Callable[[Callable[[float], None]], Any]) -> str:
        job_id = str(uuid.uuid4())
        job = Job(id=job_id, status="pending")
        with self._lock:
            self._jobs[job_id] = job

        def _progress(p: float) -> None:
            with self._lock:
                self._jobs[job_id].progress = p

        def _run() -> None:
            with self._lock:
                self._jobs[job_id].status = "running"
            try:
                result = target(_progress)
                with self._lock:
                    self._jobs[job_id].result = result
                    self._jobs[job_id].status = "done"
                    self._jobs[job_id].progress = 1.0
            except Exception as exc:  # noqa: BLE001 -- surface to API caller
                with self._lock:
                    self._jobs[job_id].status = "error"
                    self._jobs[job_id].error = f"{exc}\n{traceback.format_exc()}"

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        return job_id

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)


job_manager = JobManager()
