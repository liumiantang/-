from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from ..models.review import ReviewSchedule, EBBINGHAUS_INTERVALS
from ..models.question import Question


def _get_interval_days(stage: int) -> int:
    """Get the interval in days for a given review stage (1-based)."""
    if stage < 1:
        return 1  # Default: 1 day for stage 0→1
    if stage > len(EBBINGHAUS_INTERVALS):
        return EBBINGHAUS_INTERVALS[-1]  # 30 days max
    return EBBINGHAUS_INTERVALS[stage - 1]


def schedule_review(db: Session, question_id: int, is_correct: bool) -> Optional[dict]:
    """Update review schedule after answering a question.

    Called automatically after every answer in practice mode.
    - Correct: advance stage, set next_review_at based on new stage interval
    - Wrong: reset to stage 0, review again in 1 day
    """
    record = db.query(ReviewSchedule).filter(ReviewSchedule.question_id == question_id).first()

    if record is None:
        # First time this question is answered
        record = ReviewSchedule(
            question_id=question_id,
            stage=1 if is_correct else 0,
            review_count=1,
            last_reviewed_at=datetime.now(),
        )
        db.add(record)
    else:
        record.review_count += 1
        record.last_reviewed_at = datetime.now()
        if is_correct:
            record.stage = min(record.stage + 1, 6)
        else:
            record.stage = 0

    # Calculate next review date
    if record.stage >= 6:
        # Fully mastered — no more reviews needed
        record.next_review_at = None
    else:
        interval_days = _get_interval_days(record.stage)
        record.next_review_at = datetime.now() + timedelta(days=interval_days)

    db.commit()
    db.refresh(record)

    return {
        "stage": record.stage,
        "next_review_at": record.next_review_at.isoformat() if record.next_review_at else None,
        "review_count": record.review_count,
    }


def get_due_reviews(
    db: Session,
    bank_ids: Optional[list[int]] = None,
    limit: Optional[int] = None,
) -> list[dict]:
    """Get questions that are due for review (next_review_at <= now)."""
    now = datetime.now()
    # Join with ReviewSchedule and select both in one query
    query = (
        db.query(Question, ReviewSchedule)
        .join(ReviewSchedule, ReviewSchedule.question_id == Question.id)
        .filter(ReviewSchedule.next_review_at <= now)
        .filter(ReviewSchedule.next_review_at.isnot(None))
    )
    if bank_ids:
        query = query.filter(Question.bank_id.in_(bank_ids))
    query = query.order_by(ReviewSchedule.next_review_at.asc())

    if limit:
        query = query.limit(limit)

    result = []
    for q, rs in query.all():
        result.append({
            "id": q.id,
            "bank_id": q.bank_id,
            "type": q.type,
            "difficulty": q.difficulty,
            "content": q.content,
            "options": q.options,
            "answer": q.answer,
            "explanation": q.explanation,
            "tags": q.tags,
            "review_stage": rs.stage if rs else 0,
            "next_review_at": rs.next_review_at.isoformat() if rs and rs.next_review_at else None,
        })
    return result


def get_review_stats(db: Session) -> dict:
    """Get review statistics: due count, stage distribution."""
    now = datetime.now()

    total_scheduled = db.query(ReviewSchedule).count()
    due_count = (
        db.query(ReviewSchedule)
        .filter(ReviewSchedule.next_review_at <= now)
        .filter(ReviewSchedule.next_review_at.isnot(None))
        .count()
    )

    # Stage distribution — single query with GROUP BY
    from sqlalchemy import func
    rows = (
        db.query(ReviewSchedule.stage, func.count(ReviewSchedule.id))
        .group_by(ReviewSchedule.stage)
        .all()
    )
    stage_dist = {str(stage): cnt for stage, cnt in rows}

    # Fully mastered (stage 6, no next review)
    mastered = db.query(ReviewSchedule).filter(ReviewSchedule.stage >= 6).count()

    return {
        "total_scheduled": total_scheduled,
        "due_count": due_count,
        "mastered_count": mastered,
        "stage_distribution": stage_dist,
    }


def _get_stage_for_question(db: Session, question_id: int) -> int:
    record = db.query(ReviewSchedule).filter(ReviewSchedule.question_id == question_id).first()
    return record.stage if record else 0


def _get_next_review_for_question(db: Session, question_id: int) -> Optional[str]:
    record = db.query(ReviewSchedule).filter(ReviewSchedule.question_id == question_id).first()
    if record and record.next_review_at:
        return record.next_review_at.isoformat()
    return None
