from __future__ import annotations
from typing import Optional
import os
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.bank import QuestionBank
from ..models.question import Question
from ..parser.auto_parser import AutoParser


def create_bank(db: Session, name: str, description: str = "") -> QuestionBank:
    bank = QuestionBank(name=name, description=description)
    db.add(bank)
    db.commit()
    db.refresh(bank)
    return bank


def list_banks(db: Session) -> list[QuestionBank]:
    return db.query(QuestionBank).order_by(QuestionBank.updated_at.desc()).all()


def get_bank(db: Session, bank_id: int) -> Optional[QuestionBank]:
    return db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()


def delete_bank(db: Session, bank_id: int) -> bool:
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
    if not bank:
        return False
    db.delete(bank)
    db.commit()
    return True


def import_document(db: Session, bank_id: int, filepath: str, original_filename: str) -> int:
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
    if not bank:
        raise ValueError("题库不存在")

    # For Excel format, use the original Excel parser (table-based)
    ext = original_filename.rsplit(".", 1)[-1].lower()
    if ext in ("xlsx", "xls"):
        from ..parser.excel_parser import ExcelParser
        parsed = ExcelParser().parse_file(filepath)
    elif ext == "csv":
        from ..parser.csv_parser import CsvParser
        parsed = CsvParser().parse_file(filepath)
    else:
        parsed = AutoParser().parse_file(filepath)

    count = 0
    for pq in parsed:
        q = Question(
            bank_id=bank_id,
            type=pq.type,
            difficulty=pq.difficulty,
            content=pq.content,
            answer=pq.answer,
            explanation=pq.explanation,
        )
        q.tags = pq.tags
        q.options = pq.options
        db.add(q)
        count += 1

    db.commit()
    return count


def get_questions(
    db: Session,
    bank_id: int,
    q_type: Optional[str] = None,
    difficulty: Optional[int] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Question], int]:
    q = db.query(Question).filter(Question.bank_id == bank_id)

    if q_type:
        q = q.filter(Question.type == q_type)
    if difficulty:
        q = q.filter(Question.difficulty == difficulty)
    if tag:
        q = q.filter(Question._tags.contains(tag))
    if search:
        q = q.filter(Question.content.contains(search))

    total = q.count()
    questions = q.order_by(Question.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return questions, total


def update_question(db: Session, question_id: int, data: dict) -> Optional[Question]:
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        return None
    for key in ("type", "difficulty", "content", "answer", "explanation"):
        if key in data:
            setattr(q, key, data[key])
    if "tags" in data:
        q.tags = data["tags"]
    if "options" in data:
        q.options = data["options"]
    db.commit()
    db.refresh(q)
    return q


def delete_question(db: Session, question_id: int) -> bool:
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        return False
    db.delete(q)
    db.commit()
    return True
