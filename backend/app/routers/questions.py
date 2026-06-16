from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.favorite import Favorite
from ..models.question import Question
from ..services import bank_service

router = APIRouter()


@router.get("/banks/{bank_id}/questions")
def get_questions(
    bank_id: int,
    type: Optional[str] = Query(None, alias="type"),
    difficulty: Optional[int] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    bank = bank_service.get_bank(db, bank_id)
    if not bank:
        raise HTTPException(404, "题库不存在")

    questions, total = bank_service.get_questions(
        db, bank_id, q_type=type, difficulty=difficulty,
        tag=tag, search=search, page=page, page_size=page_size,
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "questions": [
            {
                "id": q.id,
                "bank_id": q.bank_id,
                "type": q.type,
                "difficulty": q.difficulty,
                "tags": q.tags,
                "content": q.content,
                "options": q.options,
                "answer": q.answer,
                "explanation": q.explanation,
            }
            for q in questions
        ],
    }


@router.put("/questions/{question_id}")
def update_question(question_id: int, data: dict, db: Session = Depends(get_db)):
    q = bank_service.update_question(db, question_id, data)
    if not q:
        raise HTTPException(404, "题目不存在")
    return {"ok": True}


@router.delete("/questions/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)):
    ok = bank_service.delete_question(db, question_id)
    if not ok:
        raise HTTPException(404, "题目不存在")
    return {"ok": True}


# ── Favorites ──────────────────────────────────────────────

@router.post("/questions/{question_id}/favorite")
def add_favorite(question_id: int, db: Session = Depends(get_db)):
    existing = db.query(Favorite).filter(Favorite.question_id == question_id).first()
    if not existing:
        db.add(Favorite(question_id=question_id))
        db.commit()
    return {"ok": True}


@router.delete("/questions/{question_id}/favorite")
def remove_favorite(question_id: int, db: Session = Depends(get_db)):
    db.query(Favorite).filter(Favorite.question_id == question_id).delete()
    db.commit()
    return {"ok": True}


@router.get("/favorites")
def list_favorites(db: Session = Depends(get_db)):
    favs = db.query(Favorite).order_by(Favorite.created_at.desc()).all()
    if not favs:
        return {"items": [], "total": 0}
    # Batch-load all favorited questions in a single query
    qid_map = {f.question_id: f.id for f in favs}
    questions = db.query(Question).filter(Question.id.in_(list(qid_map.keys()))).all()
    q_map = {q.id: q for q in questions}
    items = []
    for qid, fid in qid_map.items():
        q = q_map.get(qid)
        if q:
            items.append({
                "favorite_id": fid,
                "question_id": q.id,
                "type": q.type,
                "content": q.content,
                "options": q.options,
                "answer": q.answer,
                "explanation": q.explanation,
                "tags": q.tags,
                "difficulty": q.difficulty,
                "bank_id": q.bank_id,
            })
    return {"items": items, "total": len(items)}
