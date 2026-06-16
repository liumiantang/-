"""AI router — generate questions, explain, config."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from .. import ai_config, ai_usage
from ..services import ai_service, bank_service
from ..models.question import Question

router = APIRouter()


# ── Request models ──────────────────────────────────────────

class GenerateRequest(BaseModel):
    text: str
    bank_id: int
    count: int = 5
    types: list[str] = ["single_choice"]
    difficulty: int = 3


class ConfigUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model: Optional[str] = None


# ── Generate ─────────────────────────────────────────────────

@router.post("/api/ai/generate")
def generate(req: GenerateRequest, db: Session = Depends(get_db)):
    bank = bank_service.get_bank(db, req.bank_id)
    if not bank:
        raise HTTPException(404, "题库不存在")

    questions = ai_service.generate_questions(
        text=req.text,
        count=min(req.count, 20),
        types=req.types,
        difficulty=req.difficulty,
    )

    if not questions:
        raise HTTPException(400, "AI 生成失败，请检查 API 配置或文本内容")

    imported = []
    for q in questions:
        question = Question(
            bank_id=req.bank_id,
            type=q.get("type", "single_choice"),
            difficulty=q.get("difficulty", req.difficulty),
            content=q.get("content", ""),
            answer=q.get("answer", ""),
            explanation=q.get("explanation", ""),
        )
        question.tags = q.get("tags", [])
        question.options = q.get("options", {})
        db.add(question)
        imported.append(question)

    db.commit()

    return {
        "imported": len(imported),
        "questions": [
            {
                "id": q.id,
                "type": q.type,
                "content": q.content,
                "options": q.options,
                "answer": q.answer,
                "explanation": q.explanation,
                "tags": q.tags,
                "difficulty": q.difficulty,
            }
            for q in imported
        ],
    }


# ── Explain ──────────────────────────────────────────────────

@router.post("/api/ai/explain/{question_id}")
def explain(question_id: int, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(404, "题目不存在")

    explanation = ai_service.explain_question(
        content=q.content,
        options=q.options if q.options else None,
        answer=q.answer,
        q_type=q.type,
    )

    if not explanation:
        raise HTTPException(400, "AI 解析失败，请检查 API 配置")

    # Save to database
    q.explanation = explanation
    db.commit()

    return {"explanation": explanation, "question_id": question_id}


# ── Config ───────────────────────────────────────────────────

@router.get("/api/ai/config")
def get_config():
    cfg = ai_config.load_config()
    return {
        "provider": cfg.get("provider", ""),
        "has_key": bool(cfg.get("api_key")),
        "api_base": cfg.get("api_base", ""),
        "model": cfg.get("model", ""),
        "presets": {
            k: {"api_base": v["api_base"], "model": v["model"]}
            for k, v in ai_config.get_presets().items()
        },
    }


@router.put("/api/ai/config")
def update_config(data: ConfigUpdate):
    cfg = ai_config.load_config()

    if data.provider is not None:
        cfg["provider"] = data.provider
        presets = ai_config.get_presets()
        if data.provider in presets:
            cfg["api_base"] = presets[data.provider]["api_base"]
            cfg["model"] = presets[data.provider]["model"]

    if data.api_key is not None:
        cfg["api_key"] = data.api_key

    if data.api_base is not None:
        cfg["api_base"] = data.api_base

    if data.model is not None:
        cfg["model"] = data.model

    ai_config.save_config(cfg)
    return {"ok": True}


# ── Test ─────────────────────────────────────────────────────

@router.post("/api/ai/test")
def test_connection():
    result = ai_service.test_connection()
    return result


# ── Usage ────────────────────────────────────────────────────

@router.get("/api/ai/usage")
def get_usage():
    return ai_usage.get_usage()


@router.delete("/api/ai/usage")
def clear_usage():
    ai_usage.clear_usage()
    return {"ok": True}
