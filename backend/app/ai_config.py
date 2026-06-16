"""AI configuration management — reads/writes ai_config.json."""
from __future__ import annotations
import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ai_config.json")

PRESETS = {
    "deepseek":  {"api_base": "https://api.deepseek.com/v1", "model": "deepseek-chat"},
    "openai":    {"api_base": "https://api.openai.com/v1",   "model": "gpt-4o-mini"},
    "qwen":      {"api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-plus"},
    "ollama":    {"api_base": "http://localhost:11434/v1",    "model": "llama3"},
    "custom":    {"api_base": "", "model": ""},
}

DEFAULT_CONFIG = {
    "provider": "deepseek",
    "api_key": "",
    "api_base": PRESETS["deepseek"]["api_base"],
    "model": PRESETS["deepseek"]["model"],
}


def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    cfg = dict(DEFAULT_CONFIG)
    save_config(cfg)
    return cfg


def save_config(data: dict) -> None:
    cfg = {
        "provider": data.get("provider", DEFAULT_CONFIG["provider"]),
        "api_key": data.get("api_key", DEFAULT_CONFIG["api_key"]),
        "api_base": data.get("api_base", DEFAULT_CONFIG["api_base"]),
        "model": data.get("model", DEFAULT_CONFIG["model"]),
    }
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def get_presets() -> dict:
    return dict(PRESETS)
