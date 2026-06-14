from __future__ import annotations
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..models.quiz import QuizSession, QuizAnswer
from ..models.question import Question
from .picker_service import pick_questions


def start_session(
    db: Session,
    bank_ids: list[int],
    count: int,
    difficulty_min: int = 1,
    difficulty_max: int = 5,
    tags: Optional[list[str]] = None,
    type_filter: Optional[list[str]] = None,
    exclude_previous_correct: bool = False,
    mode: str = "exam",
) -> QuizSession:
    exclude_ids = []
    if exclude_previous_correct:
        # Exclude questions user already answered correctly
        correct_ids = (
            db.query(QuizAnswer.question_id)
            .filter(QuizAnswer.is_correct == True)  # noqa: E712
            .distinct()
            .all()
        )
        exclude_ids = [r[0] for r in correct_ids]

    questions = pick_questions(
        db=db,
        bank_ids=bank_ids,
        count=count,
        difficulty_min=difficulty_min,
        difficulty_max=difficulty_max,
        tags=tags,
        type_filter=type_filter,
        exclude_ids=exclude_ids,
    )

    session = QuizSession(
        bank_ids=str(bank_ids),
        total_questions=len(questions),
        is_finished=False,
    )
    session.settings = {
        "count": count,
        "difficulty_min": difficulty_min,
        "difficulty_max": difficulty_max,
        "tags": tags or [],
        "type_filter": type_filter or [],
        "exclude_previous_correct": exclude_previous_correct,
        "mode": mode,
    }
    db.add(session)
    db.flush()

    for q in questions:
        answer = QuizAnswer(
            session_id=session.id,
            question_id=q.id,
            user_answer="",
            is_correct=None,
        )
        db.add(answer)

    db.commit()
    db.refresh(session)
    return session


def get_session(db: Session, session_id: int) -> tuple[Optional[QuizSession], Optional[list[dict]]]:
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    if not session:
        return None, None

    items = []
    for ans in session.answers:
        q = db.query(Question).filter(Question.id == ans.question_id).first()
        if q:
            items.append({
                "answer_id": ans.id,
                "question_id": q.id,
                "type": q.type,
                "content": q.content,
                "options": q.options,
                "user_answer": ans.user_answer if session.is_finished else "",
                "is_correct": ans.is_correct if session.is_finished else None,
                "explanation": q.explanation if session.is_finished else "",
                "correct_answer": q.answer if session.is_finished else "",
            })
    return session, items


def submit_answer(db: Session, session_id: int, answer_id: int, user_answer: str, mode: str = "exam") -> Optional[dict]:
    ans = (
        db.query(QuizAnswer)
        .filter(QuizAnswer.id == answer_id, QuizAnswer.session_id == session_id)
        .first()
    )
    if not ans:
        return None

    q = db.query(Question).filter(Question.id == ans.question_id).first()
    if not q:
        return None

    ans.user_answer = user_answer.strip()
    ans.is_correct = check_answer(q.type, user_answer.strip(), q.answer)
    ans.answered_at = datetime.now()
    db.commit()

    if mode == "practice":
        return {
            "is_correct": ans.is_correct,
            "correct_answer": q.answer if q.type != "essay" else "",
            "explanation": q.explanation,
        }
    else:
        # Exam mode: don't reveal correct answer or explanation
        return {
            "is_correct": None,  # Don't reveal correctness until finished
            "correct_answer": "",
            "explanation": "",
        }


def finish_session(db: Session, session_id: int) -> Optional[dict]:
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    if not session:
        return None

    # Count correct
    correct = (
        db.query(QuizAnswer)
        .filter(QuizAnswer.session_id == session_id, QuizAnswer.is_correct == True)  # noqa: E712
        .count()
    )

    session.correct_count = correct
    session.score = round(correct / session.total_questions * 100, 1) if session.total_questions > 0 else 0
    session.is_finished = True
    session.finished_at = datetime.now()
    db.commit()

    return {
        "total": session.total_questions,
        "correct": session.correct_count,
        "score": session.score,
    }


def get_history(db: Session, page: int = 1, page_size: int = 20) -> tuple[list[dict], int]:
    total = db.query(QuizSession).count()
    sessions = (
        db.query(QuizSession)
        .filter(QuizSession.is_finished == True)  # noqa: E712
        .order_by(QuizSession.finished_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "total_questions": s.total_questions,
            "correct_count": s.correct_count,
            "score": s.score,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
        })
    return result, total


# ── answer checking ──────────────────────────────────────────────

def delete_session(db: Session, session_id: int) -> bool:
    session = db.query(QuizSession).filter(QuizSession.id == session_id).first()
    if not session:
        return False
    db.delete(session)  # cascade deletes answers
    db.commit()
    return True


def check_answer(q_type: str, user_answer: str, correct_answer: str) -> bool:
    if q_type == "single_choice":
        return user_answer.upper() == correct_answer.upper().strip()
    elif q_type == "multi_choice":
        return "".join(sorted(user_answer.upper())) == "".join(sorted(correct_answer.upper().strip()))
    elif q_type == "true_false":
        return user_answer == correct_answer.strip()
    elif q_type == "fill_blank":
        return user_answer.strip() == correct_answer.strip()
    elif q_type == "essay":
        return None  # Manual grading needed
    return False
