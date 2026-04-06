from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from supabase import Client, create_client

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def get_next_pending_job(client: Client) -> dict | None:
    resp = (
        client.table("backtest_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]
    return None


def mark_job_running(client: Client, job_id: str) -> None:
    client.table("backtest_jobs").update({"status": "running"}).eq("id", job_id).execute()
    logger.info("Job %s → running", job_id)


def mark_job_completed(client: Client, job_id: str) -> None:
    client.table("backtest_jobs").update({
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()
    logger.info("Job %s → completed", job_id)


def mark_job_failed(client: Client, job_id: str, error: str) -> None:
    client.table("backtest_jobs").update({
        "status": "failed",
        "error_message": error,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()
    logger.warning("Job %s → failed: %s", job_id, error)


def get_strategy_by_id(client: Client, strategy_id: str) -> dict | None:
    resp = (
        client.table("strategies")
        .select("*")
        .eq("id", strategy_id)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0]
    return None


def save_backtest_result(
    client: Client,
    job_id: str,
    metrics: dict,
    equity_curve: list[float],
    trades: list[dict],
) -> None:
    client.table("backtest_results").insert({
        "job_id": job_id,
        "metrics": metrics,
        "equity_curve": equity_curve,
        "trades": trades,
        "summary": None,
    }).execute()
    logger.info("Results saved for job %s", job_id)
