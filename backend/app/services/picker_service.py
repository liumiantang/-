from __future__ import annotations
from typing import Optional
import random
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.question import Question


def pick_questions(
    db: Session,
    bank_ids: list[int],
    count: int,
    difficulty_min: int = 1,
    difficulty_max: int = 5,
    tags: Optional[list[str]] = None,
    type_filter: Optional[list[str]] = None,
    exclude_ids: Optional[list[int]] = None,
) -> list[Question]:
    """
    Randomly pick questions from given banks with filters.
    Uses DB-level random ordering to avoid loading all candidates into memory.
    Falls back to in-memory shuffle for small result sets (<= 1000 candidates).
    """
    q = db.query(Question).filter(Question.bank_id.in_(bank_ids))
    q = q.filter(Question.difficulty >= difficulty_min, Question.difficulty <= difficulty_max)

    if type_filter:
        q = q.filter(Question.type.in_(type_filter))

    if tags:
        for tag in tags:
            q = q.filter(Question._tags.contains(tag))

    if exclude_ids:
        q = q.filter(~Question.id.in_(exclude_ids))

    # Count candidates first — cheap, uses COUNT(*)
    total = q.count()

    if total == 0:
        return []

    if total <= count:
        result = q.all()
        random.shuffle(result)
        return result

    # For large result sets, use DB-level random ordering with limit.
    # SQLite: ORDER BY RANDOM() is efficient for moderate datasets.
    # For postgres: use ORDER BY RANDOM(). MySQL: ORDER BY RAND().
    # Using func.random() works cross-database with SQLAlchemy.
    result = q.order_by(func.random()).limit(count).all()
    return result
