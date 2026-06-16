import json
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    bank_id: Mapped[int] = mapped_column(Integer, ForeignKey("question_banks.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False)  # single_choice/multi_choice/true_false/fill_blank/essay
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    _tags: Mapped[str] = mapped_column("tags", Text, default="[]")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    _options: Mapped[str] = mapped_column("options", Text, default="{}")
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    bank: Mapped["QuestionBank"] = relationship(back_populates="questions")

    @property
    def tags(self) -> list[str]:
        return json.loads(self._tags)

    @tags.setter
    def tags(self, value: list[str]):
        self._tags = json.dumps(value, ensure_ascii=False)

    @property
    def options(self) -> dict[str, str]:
        return json.loads(self._options)

    @options.setter
    def options(self, value: dict[str, str]):
        self._options = json.dumps(value, ensure_ascii=False)
