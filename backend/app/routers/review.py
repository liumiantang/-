from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import review_service

router = APIRouter()


@router.get("/review/due")
def get_due_reviews(
    bank_ids: Optional[str] = Query(None, description="Comma-separated bank IDs, e.g. 1,2,3"),
    limit: Optional[int] = Query(None, description="Max questions to return"),
    db: Session = Depends(get_db),
):
    """Get questions due for Ebbinghaus review."""
    ids = None
    if bank_ids:
        ids = [int(x.strip()) for x in bank_ids.split(",") if x.strip()]
    questions = review_service.get_due_reviews(db, bank_ids=ids, limit=limit)
    stats = review_service.get_review_stats(db)
    return {
        "count": len(questions),
        "due_count": stats["due_count"],
        "mastered_count": stats["mastered_count"],
        "stage_distribution": stats["stage_distribution"],
        "questions": questions,
    }


@router.get("/review/stats")
def get_review_stats(db: Session = Depends(get_db)):
    """Get review statistics only (no question data)."""
    return review_service.get_review_stats(db)
