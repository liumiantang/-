from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import quiz_service

router = APIRouter()


class StartQuizRequest(BaseModel):
    bank_ids: list[int]
    count: int = 10
    difficulty_min: int = 1
    difficulty_max: int = 5
    tags: Optional[list[str]] = None
    type_filter: Optional[list[str]] = None
    exclude_previous_correct: bool = False
    mode: str = "exam"  # "practice", "exam", or "review" (Ebbinghaus spaced repetition)
    time_limit: Optional[int] = None  # 考试时间限制（分钟），仅 exam 模式有效


@router.get("/quiz/history")
def get_history(page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    items, total = quiz_service.get_history(db, page, page_size)
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/quiz/start")
def start_quiz(req: StartQuizRequest, db: Session = Depends(get_db)):
    session = quiz_service.start_session(
        db=db,
        bank_ids=req.bank_ids,
        count=req.count,
        difficulty_min=req.difficulty_min,
        difficulty_max=req.difficulty_max,
        tags=req.tags,
        type_filter=req.type_filter,
        exclude_previous_correct=req.exclude_previous_correct,
        mode=req.mode,
        time_limit=req.time_limit,
    )
    _, items = quiz_service.get_session(db, session.id)
    return {
        "session_id": session.id,
        "total_questions": session.total_questions,
        "questions": items,
    }


@router.get("/quiz/{session_id}")
def get_quiz(session_id: int, db: Session = Depends(get_db)):
    session, items = quiz_service.get_session(db, session_id)
    if not session:
        raise HTTPException(404, "作答记录不存在")
    pending_count = sum(
        1 for item in (items or [])
        if item.get("type") == "essay"
        and item.get("user_answer", "").strip()
        and item.get("ai_score") is None
    ) if session.is_finished else 0
    return {
        "session_id": session.id,
        "is_finished": session.is_finished,
        "total_questions": session.total_questions,
        "score": session.score if session.is_finished else None,
        "time_limit": session.settings.get("time_limit") if session.settings else None,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "pending_count": pending_count,
        "questions": items,
    }


class AnswerRequest(BaseModel):
    answer_id: int
    user_answer: str


@router.post("/quiz/{session_id}/answer")
def submit_answer(session_id: int, req: AnswerRequest, db: Session = Depends(get_db)):
    # Get mode from session settings
    from ..models.quiz import QuizSession
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "作答记录不存在")
    # Check time expiry for exam mode
    if quiz_service.is_time_expired(session):
        raise HTTPException(400, "考试时间已到，请交卷")
    mode = session.settings.get("mode", "exam") if session.settings else "exam"
    result = quiz_service.submit_answer(db, session_id, req.answer_id, req.user_answer, mode=mode)
    if result is None:
        raise HTTPException(404, "记录不存在")
    return result


@router.post("/quiz/{session_id}/finish")
def finish_quiz(session_id: int, db: Session = Depends(get_db)):
    result = quiz_service.finish_session(db, session_id)
    if result is None:
        raise HTTPException(404, "作答记录不存在")
    return result


@router.delete("/quiz/{session_id}")
def delete_quiz(session_id: int, db: Session = Depends(get_db)):
    ok = quiz_service.delete_session(db, session_id)
    if not ok:
        raise HTTPException(404, "作答记录不存在")
    return {"ok": True}
