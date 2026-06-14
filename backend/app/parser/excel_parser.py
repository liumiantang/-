from __future__ import annotations
from typing import Optional
from .base import ParsedQuestion, TYPE_MAP


class ExcelParser:
    COLUMN_MAP = {
        "类型": "type", "type": "type",
        "题目": "content", "题干": "content",
        "选项A": "opt_a", "A": "opt_a",
        "选项B": "opt_b", "B": "opt_b",
        "选项C": "opt_c", "C": "opt_c",
        "选项D": "opt_d", "D": "opt_d",
        "选项E": "opt_e", "E": "opt_e",
        "选项F": "opt_f", "F": "opt_f",
        "答案": "answer", "正确答案": "answer",
        "难度": "difficulty",
        "标签": "tags",
        "解析": "explanation",
    }

    def parse_file(self, filepath: str) -> list[ParsedQuestion]:
        import openpyxl

        wb = openpyxl.load_workbook(filepath)
        ws = wb.active

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        # Map header row
        headers = [str(c).strip() if c else "" for c in rows[0]]
        col_map = {}
        for i, h in enumerate(headers):
            key = self.COLUMN_MAP.get(h)
            if key:
                col_map[key] = i

        questions = []
        for row in rows[1:]:
            if not row or not any(row):
                continue
            q = self._parse_row(row, col_map)
            if q and q.content and q.answer:
                questions.append(q)

        wb.close()
        return questions

    def _parse_row(self, row: tuple, col_map: dict) -> Optional[ParsedQuestion]:
        def get(key):
            idx = col_map.get(key)
            if idx is not None and idx < len(row):
                val = row[idx]
                return str(val).strip() if val is not None else ""
            return ""

        q = ParsedQuestion(type="single_choice")
        q_type = get("type")
        q.type = TYPE_MAP.get(q_type, "single_choice")
        q.content = get("content")
        q.answer = get("answer")
        q.explanation = get("explanation")

        diff = get("difficulty")
        try:
            q.difficulty = int(float(diff))
        except (ValueError, TypeError):
            q.difficulty = 1

        tags = get("tags")
        q.tags = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

        options = {}
        for k in ["opt_a", "opt_b", "opt_c", "opt_d", "opt_e", "opt_f"]:
            v = get(k)
            if v:
                options[k.replace("opt_", "").upper()] = v
        q.options = options

        return q
