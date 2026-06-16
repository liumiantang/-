"""Parse CSV files with question data."""
from __future__ import annotations
import csv
import codecs
from .base import ParsedQuestion, TYPE_MAP

COLUMN_MAP = {
    "类型": "type",
    "题型": "type",
    "type": "type",
    "题目": "content",
    "题干": "content",
    "题目内容": "content",
    "content": "content",
    "选项A": "opt_a",
    "A": "opt_a",
    "选项B": "opt_b",
    "B": "opt_b",
    "选项C": "opt_c",
    "C": "opt_c",
    "选项D": "opt_d",
    "D": "opt_d",
    "选项E": "opt_e",
    "E": "opt_e",
    "选项F": "opt_f",
    "F": "opt_f",
    "选项G": "opt_g",
    "G": "opt_g",
    "选项H": "opt_h",
    "H": "opt_h",
    "答案": "answer",
    "正确答案": "answer",
    "answer": "answer",
    "难度": "difficulty",
    "difficulty": "difficulty",
    "标签": "tags",
    "tags": "tags",
    "解析": "explanation",
    "explanation": "explanation",
}


class CsvParser:
    def parse_file(self, filepath: str) -> list[ParsedQuestion]:
        # Try encodings
        reader = None
        for encoding in ("utf-8", "utf-8-sig", "gbk", "gb2312"):
            try:
                f = open(filepath, "r", encoding=encoding, newline="")
                reader = csv.DictReader(f)
                # Test reading first row to verify encoding
                next(reader, None)
                f.seek(0)
                reader = csv.DictReader(f)
                break
            except (UnicodeDecodeError, UnicodeError):
                if not f.closed:
                    f.close()
                continue

        if reader is None:
            # Final fallback
            f = open(filepath, "r", encoding="utf-8", errors="replace", newline="")
            reader = csv.DictReader(f)

        # Build column mapping from CSV headers
        headers = reader.fieldnames or []
        col_map = self._build_column_map(headers)

        questions = []
        for row in reader:
            q = self._parse_row(row, col_map)
            if q and q.content and q.answer:
                questions.append(q)

        f.close()
        return questions

    def extract_bank_name(self, filepath: str) -> str:
        return "未命名题库"

    def _build_column_map(self, headers: list[str]) -> dict:
        """Map CSV column names to internal fields."""
        mapping = {}
        for h in headers:
            h_clean = h.strip()
            key = COLUMN_MAP.get(h_clean)
            if key:
                mapping[key] = h
        return mapping

    def _parse_row(self, row: dict, col_map: dict) -> ParsedQuestion | None:
        q = ParsedQuestion(type="single_choice")

        # Type
        type_raw = self._get(row, col_map, "type")
        if type_raw:
            q.type = TYPE_MAP.get(type_raw, "single_choice")

        # Content
        q.content = self._get(row, col_map, "content") or ""

        # Options A-H
        for letter in "ABCDEFGH":
            opt_val = self._get(row, col_map, f"opt_{letter.lower()}")
            if opt_val:
                q.options[letter] = opt_val

        # Answer
        q.answer = self._get(row, col_map, "answer") or ""

        # Difficulty
        diff_str = self._get(row, col_map, "difficulty")
        if diff_str:
            try:
                q.difficulty = int(float(diff_str))
            except (ValueError, TypeError):
                q.difficulty = 1

        # Tags
        tags_str = self._get(row, col_map, "tags")
        if tags_str:
            q.tags = [t.strip() for t in tags_str.split(",") if t.strip()]

        # Explanation
        q.explanation = self._get(row, col_map, "explanation") or ""

        return q

    def _get(self, row: dict, col_map: dict, key: str) -> str | None:
        """Get a value from the row using the column mapping."""
        header = col_map.get(key)
        if not header:
            return None
        val = row.get(header, "")
        if val is None:
            return None
        val = str(val).strip()
        return val if val else None
