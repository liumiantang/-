import os
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.bank import QuestionBank
from ..models.question import Question
from ..models.quiz import QuizAnswer
from ..services import bank_service

router = APIRouter()
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "uploads")
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB


@router.get("/banks")
def list_banks(db: Session = Depends(get_db)):
    banks = bank_service.list_banks(db)
    # Batch-load question counts to avoid N+1 queries
    bank_ids = [b.id for b in banks]
    count_map = {}
    if bank_ids:
        rows = (
            db.query(Question.bank_id, func.count(Question.id))
            .filter(Question.bank_id.in_(bank_ids))
            .group_by(Question.bank_id)
            .all()
        )
        count_map = {bid: cnt for bid, cnt in rows}
    return [
        {
            "id": b.id,
            "name": b.name,
            "description": b.description,
            "question_count": count_map.get(b.id, 0),
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in banks
    ]


@router.post("/banks")
def create_bank(name: str = Form(...), description: str = Form(""), db: Session = Depends(get_db)):
    bank = bank_service.create_bank(db, name, description)
    return {"id": bank.id, "name": bank.name, "description": bank.description}


@router.get("/banks/{bank_id}")
def get_bank(bank_id: int, db: Session = Depends(get_db)):
    bank = bank_service.get_bank(db, bank_id)
    if not bank:
        raise HTTPException(404, "题库不存在")
    question_count = db.query(func.count(Question.id)).filter(Question.bank_id == bank_id).scalar() or 0
    return {
        "id": bank.id,
        "name": bank.name,
        "description": bank.description,
        "question_count": question_count,
        "created_at": bank.created_at.isoformat() if bank.created_at else None,
    }


@router.delete("/banks/{bank_id}")
def delete_bank(bank_id: int, db: Session = Depends(get_db)):
    ok = bank_service.delete_bank(db, bank_id)
    if not ok:
        raise HTTPException(404, "题库不存在")
    return {"ok": True}


@router.post("/banks/{bank_id}/import")
def import_questions(bank_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Security: prevent path traversal via malicious filename
    original_name = file.filename or "upload"
    safe_name = os.path.basename(original_name)
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(400, "无效的文件名")

    # Validate file size
    if hasattr(file, 'size') and file.size and file.size > MAX_UPLOAD_SIZE:
        raise HTTPException(400, f"文件大小超过限制 ({MAX_UPLOAD_SIZE // 1024 // 1024}MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    try:
        with open(filepath, "wb") as f:
            shutil.copyfileobj(file.file, f)

        count = bank_service.import_document(db, bank_id, filepath, original_name)
        return {"imported": count, "filename": original_name}
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        # Clean up uploaded file to prevent disk accumulation
        try:
            os.remove(filepath)
        except OSError:
            pass


@router.post("/banks/{bank_id}/import-ai")
def import_document_ai(
    bank_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import questions from a document using AI to parse the extracted text."""
    original_name = file.filename or "untitled"
    safe_name = os.path.basename(original_name)

    # Size limit: 50 MB
    MAX_SIZE = 50 * 1024 * 1024
    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    try:
        with open(filepath, "wb") as f:
            shutil.copyfileobj(file.file, f)

        count = bank_service.import_document_ai(db, bank_id, filepath, original_name)
        return {"imported": count, "filename": original_name, "method": "ai"}
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        try:
            os.remove(filepath)
        except OSError:
            pass


@router.post("/banks/wrong-answer-book")
def create_wrong_answer_book(db: Session = Depends(get_db)):
    # Find all wrong-answered questions
    wrong_rows = (
        db.query(QuizAnswer.question_id)
        .filter(QuizAnswer.is_correct == False)  # noqa: E712
        .distinct()
        .all()
    )
    wrong_ids = [r[0] for r in wrong_rows]

    if not wrong_ids:
        return {"ok": True, "bank_id": None, "message": "暂无错题"}

    # Find or create "错题本" bank
    bank = db.query(QuestionBank).filter(QuestionBank.name == "错题本").first()
    if bank:
        # Clear old questions
        db.query(Question).filter(Question.bank_id == bank.id).delete()
    else:
        bank = QuestionBank(name="错题本", description="自动生成的错题本")
        db.add(bank)
        db.flush()

    # Copy wrong questions into the bank — batch load to avoid N+1
    orig_map = {}
    if wrong_ids:
        origs = db.query(Question).filter(Question.id.in_(wrong_ids)).all()
        orig_map = {o.id: o for o in origs}

    count = 0
    for qid in wrong_ids:
        orig = orig_map.get(qid)
        if orig:
            copy = Question(
                bank_id=bank.id,
                type=orig.type,
                difficulty=orig.difficulty,
                content=orig.content,
                answer=orig.answer,
                explanation=orig.explanation,
            )
            copy.tags = orig.tags
            copy.options = orig.options
            db.add(copy)
            count += 1

    db.commit()
    return {"ok": True, "bank_id": bank.id, "count": count}
