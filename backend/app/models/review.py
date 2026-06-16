from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


# Ebbinghaus intervals in days: stage 1→2, 2→3, 3→4, 4→5, 5→6
EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30]


class ReviewSchedule(Base):
    __tablename__ = "review_schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id"), unique=True, nullable=False)
    stage: Mapped[int] = mapped_column(Integer, default=0)  # 0=never reviewed, 1-6=review stage
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
