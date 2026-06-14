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
    exclude_ids: question IDs to exclude (e.g., already answered correctly before).
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

    candidates = q.all()

    if len(candidates) <= count:
        result = list(candidates)
    else:
        result = random.sample(candidates, count)

    random.shuffle(result)
    return result
