"""Token usage tracking — logs to ai_usage.json."""
from __future__ import annotations
import json
import os
from datetime import datetime

LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ai_usage.json")

# Cost per 1M tokens (RMB), prompt / completion
COST_RATES = {
    "deepseek":  {"prompt": 1.0,  "completion": 2.0},
    "openai":    {"prompt": 1.05, "completion": 4.2},
    "qwen":      {"prompt": 2.0,  "completion": 8.0},
    "ollama":    {"prompt": 0,    "completion": 0},
    "custom":    {"prompt": 1.0,  "completion": 2.0},
}


def log_usage(action: str, provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> None:
    """Append a usage entry to the log."""
    rates = COST_RATES.get(provider, COST_RATES["custom"])
    prompt_cost = prompt_tokens / 1_000_000 * rates["prompt"]
    completion_cost = completion_tokens / 1_000_000 * rates["completion"]
    total_cost = prompt_cost + completion_cost

    entry = {
        "time": datetime.now().isoformat(),
        "action": action,  # "generate" or "explain" or "test"
        "provider": provider,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "cost": round(total_cost, 6),
    }

    log = []
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH, "r", encoding="utf-8") as f:
                log = json.load(f)
        except (json.JSONDecodeError, IOError):
            log = []

    log.append(entry)
    # Keep last 500 entries
    if len(log) > 500:
        log = log[-500:]

    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


def get_usage() -> dict:
    """Get usage summary."""
    log = []
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH, "r", encoding="utf-8") as f:
                log = json.load(f)
        except (json.JSONDecodeError, IOError):
            pass

    total_tokens = sum(e["total_tokens"] for e in log)
    total_cost = sum(e["cost"] for e in log)
    total_calls = len(log)

    # Per-action stats
    generate_calls = sum(1 for e in log if e["action"] == "generate")
    explain_calls = sum(1 for e in log if e["action"] == "explain")
    generate_tokens = sum(e["total_tokens"] for e in log if e["action"] == "generate")
    explain_tokens = sum(e["total_tokens"] for e in log if e["action"] == "explain")

    # Per-provider stats
    providers = {}
    for e in log:
        p = e.get("provider", "unknown")
        if p not in providers:
            providers[p] = {"calls": 0, "tokens": 0, "cost": 0}
        providers[p]["calls"] += 1
        providers[p]["tokens"] += e["total_tokens"]
        providers[p]["cost"] += e["cost"]

    return {
        "total_calls": total_calls,
        "total_tokens": total_tokens,
        "total_cost": round(total_cost, 4),
        "generate": {"calls": generate_calls, "tokens": generate_tokens},
        "explain": {"calls": explain_calls, "tokens": explain_tokens},
        "providers": providers,
        "recent": log[-50:][::-1],  # Last 50, newest first
    }


def clear_usage() -> None:
    """Clear all usage logs."""
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump([], f)
