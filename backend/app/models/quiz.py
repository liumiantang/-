from __future__ import annotations
import json
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, Boolean, Float, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    bank_ids: Mapped[str] = mapped_column(Text, nullable=False)  # JSON: [1,2]
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    _settings: Mapped[str] = mapped_column("settings", Text, default="{}")
    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_finished: Mapped[bool] = mapped_column(Boolean, default=False)

    answers = relationship("QuizAnswer", back_populates="session", cascade="all, delete-orphan")

    @property
    def settings(self) -> dict:
        return json.loads(self._settings)

    @settings.setter
    def settings(self, value: dict):
        self._settings = json.dumps(value, ensure_ascii=False)


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("quiz_sessions.id"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    user_answer: Mapped[str] = mapped_column(Text, default="")
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    ai_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)          # 0-100 AI grading score
    ai_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)          # AI grading feedback
    answered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, server_default=func.now())

    session: Mapped["QuizSession"] = relationship(back_populates="answers")
