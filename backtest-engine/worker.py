"""Backtest worker — polls Supabase for pending jobs and processes them."""

from __future__ import annotations

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Debug (môžeš neskôr zmazať)
print("SUPABASE_URL =", os.environ.get("SUPABASE_URL"))

import logging
import time
import traceback

from engine.persistence import (
    get_next_pending_job,
    get_strategy_by_id,
    get_supabase_client,
    mark_job_completed,
    mark_job_failed,
    mark_job_running,
    save_backtest_result,
)
from engine.runner import run_backtest
from engine.schema import StrategyDSL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

POLL_INTERVAL = 2  # seconds


def process_job(client, job: dict) -> None:
    job_id = job["id"]
    strategy_id = job["strategy_id"]

    mark_job_running(client, job_id)

    strategy_row = get_strategy_by_id(client, strategy_id)
    if strategy_row is None:
        mark_job_failed(client, job_id, f"Strategy {strategy_id} not found")
        return

    dsl_data = strategy_row["dsl"]

    # Apply job-level overrides
    if job.get("config"):
        dsl_data = {**dsl_data, **job["config"]}

    strategy = StrategyDSL(**dsl_data)

    result = run_backtest(strategy)

    save_backtest_result(
        client,
        job_id=job_id,
        metrics=result.metrics.model_dump(),
        equity_curve=result.equity_curve,
        trades=[t.model_dump() for t in result.trades],
    )

    mark_job_completed(client, job_id)


def main() -> None:
    logger.info("Backtest worker starting — polling every %ds", POLL_INTERVAL)
    client = get_supabase_client()

    while True:
        job = None
        try:
            job = get_next_pending_job(client)

            if job is None:
                time.sleep(POLL_INTERVAL)
                continue

            logger.info(
                "Processing job %s (strategy %s)",
                job["id"],
                job["strategy_id"],
            )

            process_job(client, job)

        except KeyboardInterrupt:
            logger.info("Worker shutting down")
            break

        except Exception:
            logger.error("Unhandled error:\n%s", traceback.format_exc())

            if job is not None:
                try:
                    mark_job_failed(
                        client,
                        job["id"],
                        traceback.format_exc()[-500:],
                    )
                except Exception:
                    logger.error("Failed to mark job as failed")

            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()