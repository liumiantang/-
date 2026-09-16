from __future__ import annotations
from typing import Optional
import os
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.bank import QuestionBank
from ..models.question import Question
from ..parser.auto_parser import AutoParser
from .. import ai_config


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


def import_document_ai(db: Session, bank_id: int, filepath: str, original_filename: str) -> int:
    """Import questions from a document using AI parsing (bypasses regex parser).

    Uses fast text extraction only (pdfplumber/PyPDF2) — skips slow OCR.
    Scanned/image-based PDFs will get a clear error message.
    """
    from . import ai_service

    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
    if not bank:
        raise ValueError("题库不存在")

    # Check AI config
    cfg = ai_config.load_config()
    if not cfg.get("api_key"):
        raise ValueError("请先在 AI 设置中配置 API Key")

    # Fast text extraction — skip slow EasyOCR/Tesseract
    ext = original_filename.rsplit(".", 1)[-1].lower()
    if ext in ("md", "txt"):
        raw_text = _read_text_file(filepath)
    elif ext == "docx":
        raw_text = _read_docx_file(filepath)
    elif ext == "pdf":
        raw_text = _read_pdf_fast(filepath)
    elif ext in ("xlsx", "xls"):
        from ..parser.excel_parser import ExcelParser
        # Excel files already have structure — just use them directly
        raw_text = _read_text_file(filepath)
    else:
        raw_text = _read_text_file(filepath)

    if not raw_text.strip():
        raise ValueError("无法从此文件中提取文字。如果是扫描件PDF，请先用普通导入。")

    print(f"[AI Import] Extracted {len(raw_text)} chars from {original_filename}", flush=True)

    # Parse with AI
    parsed = ai_service.parse_exam_text(raw_text)
    if not parsed:
        raise ValueError("AI 解析失败，请检查 AI API 配置，或尝试普通导入")

    count = 0
    for pq in parsed:
        q_type = pq.get("type", "single_choice")
        if q_type not in ("single_choice", "multi_choice", "true_false", "fill_blank", "essay"):
            q_type = "single_choice"

        q = Question(
            bank_id=bank_id,
            type=q_type,
            difficulty=pq.get("difficulty", 3),
            content=pq.get("content", ""),
            answer=pq.get("answer", ""),
            explanation=pq.get("explanation", ""),
        )
        q.tags = pq.get("tags", []) if isinstance(pq.get("tags"), list) else []
        opts = pq.get("options", {})
        if isinstance(opts, dict):
            q.options = opts
        db.add(q)
        count += 1

    db.commit()
    return count


def _read_text_file(filepath: str) -> str:
    """Read text from a plain-text file with encoding detection."""
    for encoding in ("utf-8", "gbk", "gb2312", "utf-8-sig"):
        try:
            with open(filepath, "r", encoding=encoding) as f:
                return f.read()
        except (UnicodeDecodeError, UnicodeError):
            continue
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def _read_docx_file(filepath: str) -> str:
    """Extract text from a .docx file."""
    from docx import Document
    doc = Document(filepath)
    lines = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            lines.append(text)
    for table in doc.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                lines.append(" | ".join(cells))
    return "\n".join(lines)


def _read_pdf_fast(filepath: str) -> str:
    """Fast PDF text extraction — pdfplumber then PyPDF2. No OCR fallback."""
    # 1. pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(filepath) as pdf:
            pages = []
            for p in pdf.pages:
                t = p.extract_text()
                if t and t.strip():
                    pages.append(t.strip())
            if pages:
                total_chars = sum(len(p) for p in pages)
                avg_chars_per_page = total_chars / len(pages) if pages else 0
                if avg_chars_per_page >= 100:
                    print(f"[PDF Fast] pdfplumber: {len(pages)} pages, {total_chars} chars")
                    return "\n\n".join(pages)
    except Exception:
        pass

    # 2. PyPDF2
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(filepath)
        pages = []
        for page in reader.pages:
            t = page.extract_text()
            if t and t.strip():
                pages.append(t.strip())
        if pages:
            total_chars = sum(len(p) for p in pages)
            print(f"[PDF Fast] PyPDF2: {len(pages)} pages, {total_chars} chars")
            return "\n\n".join(pages)
    except Exception:
        pass

    return ""


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
