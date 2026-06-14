"""
Auto-detect and parse exam documents:
1. Standard Markdown template (delegates to TextParser)
2. Chinese exam format with answers: 正确答案：X
3. Chinese exam format without answers: 题目N: ...
"""
from __future__ import annotations
import re
from .base import ParsedQuestion, TextParser

QUESTION_RE = re.compile(r'^(?:题目\s*\d+|^\d+)\s*[:：∶︰﹕\.、．]')
OPTION_LABELED = re.compile(r'([A-F])\s*[\.．、)）:：]')


class AutoParser:
    """Auto-detect document format and parse accordingly."""

    def parse_file(self, filepath: str) -> list[ParsedQuestion]:
        ext = filepath.rsplit(".", 1)[-1].lower()
        text = self._extract_text(filepath, ext)
        if not text.strip():
            return []

        # Try Markdown template format first
        md_questions = TextParser().parse(text)
        if md_questions:
            return md_questions

        # Try "正确答案" or "答案" format
        has_answer = "正确答案" in text
        has_daan = "答案：" in text or "答案:" in text
        has_timu = bool(re.search(r'题目\s*\d+', text))

        if has_answer or has_daan:
            return self._parse_answer_format(text)

        # Try "题目N" format (no answers)
        if has_timu:
            return self._parse_chinese_exam(text)

        return []

    def extract_bank_name(self, filepath: str) -> str:
        ext = filepath.rsplit(".", 1)[-1].lower()
        text = self._extract_text(filepath, ext)
        first_line = text.strip().split("\n")[0].strip()
        first_line = re.sub(r'^[#\s\d\.]+', '', first_line)
        return first_line[:200] if len(first_line) > 3 else "未命名题库"

    def _extract_text(self, filepath: str, ext: str) -> str:
        if ext in ("md", "txt"):
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read()
        elif ext == "docx":
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
        elif ext == "pdf":
            import pdfplumber
            with pdfplumber.open(filepath) as pdf:
                return "\n".join(p.extract_text() or "" for p in pdf.pages)
        return ""

    # ── Format: "正确答案：X" ──────────────────────────────────────

    def _parse_answer_format(self, text: str) -> list[ParsedQuestion]:
        """Parse documents where each question ends with 正确答案：X or 答案：X"""
        lines = text.strip().split("\n")
        questions = []
        current = self._new_question_block()
        current_section_type = None  # Track type from section headers

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Sub-section header: "1.1 xxxx", "1.2 xxxx"
            if re.match(r'^\d+\.\d+\s+\S', line):
                continue

            # Section type headers: 一、单选题... 二、多选题... 三、判断题...
            section_m = re.match(r'^[一二三四五六七八九十]、\s*(单选题|多选题|判断题|填空题|简答题)', line)
            if section_m:
                type_map = {
                    '单选题': 'single_choice',
                    '多选题': 'multi_choice',
                    '判断题': 'true_false',
                    '填空题': 'fill_blank',
                    '简答题': 'essay',
                }
                current_section_type = type_map.get(section_m.group(1))
                continue

            # Standalone short section title (like "导论")
            if re.match(r'^[一二三四五六七八九十]、', line) or re.match(r'^\d+\.\d+$', line):
                continue

            # Answer line: "正确答案： D" or "答案： A" or "答案：ABCD"
            answer_m = re.match(r'^(?:正确)?答案[:：]\s*(.+)$', line)
            if answer_m:
                current['answer'] = answer_m.group(1).strip()
                if current_section_type:
                    current['section_type'] = current_section_type
                questions.append(self._finalize_block(current))
                current = self._new_question_block()
                continue

            # Question line: starts with number + period/full-width punctuation
            q_m = re.match(r'^(\d+)\s*[\.、．]\s*(.+)$', line)
            if q_m:
                if current['content']:
                    # Save previous unclosed question
                    questions.append(self._finalize_block(current))
                    current = self._new_question_block()
                current['content'] = q_m.group(2).strip()
                continue

            # Option line: A、 ... or A. ... or A．...
            opt_m = re.match(r'^([A-F])\s*[\.、．)）]\s*(.+)$', line)
            if opt_m:
                current['options'][opt_m.group(1)] = opt_m.group(2).strip()
                continue

            # Continuation of question text
            if current['content']:
                # Could be continuation of question or an option without proper label
                if not current['options'] and not re.match(r'^(?:正确)?答案', line):
                    current['content'] += ' ' + line

        # Last question
        if current['content']:
            questions.append(self._finalize_block(current))

        return questions

    def _new_question_block(self):
        return {"content": "", "options": {}, "answer": ""}

    def _finalize_block(self, block: dict) -> ParsedQuestion:
        q = ParsedQuestion(type="single_choice")
        q.content = block['content'].strip()
        q.options = dict(sorted(block['options'].items()))
        q.answer = block['answer'].strip()

        # Use section type if available
        section_type = block.get('section_type')
        if section_type:
            q.type = section_type

        # Type detection (when no section type)
        opts = q.options
        if not section_type and opts:
            vals = list(opts.values())
            if all(v in ('正确', '错误', '对', '错') for v in vals):
                q.type = "true_false"
            elif len(q.answer) > 1 and all(c in 'ABCDEFGH' for c in q.answer.upper()):
                q.type = "multi_choice"

        # True/false answer mapping
        if q.type == "true_false":
            if q.answer in opts and opts[q.answer] in ('正确', '错误', '对', '错'):
                q.answer = opts[q.answer]
            elif q.answer in ('对', '正确'):
                q.answer = '正确'
            elif q.answer in ('错', '错误'):
                q.answer = '错误'
            # Auto-generate standard options if missing
            if not opts or not any(v in ('正确', '错误') for v in opts.values()):
                q.options = {'A': '正确', 'B': '错误'}

        return q

    # ── Format: "题目N" (no explicit answers) ──────────────────────

    def _parse_chinese_exam(self, text: str) -> list[ParsedQuestion]:
        lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
        if not lines:
            return []

        chunks = self._split_into_chunks(lines)
        questions = []
        for chunk_lines in chunks:
            q = self._parse_chunk(chunk_lines)
            if q and q.content:
                questions.append(q)
        return questions

    def _split_into_chunks(self, lines: list[str]) -> list[list[str]]:
        chunks = []
        current = []
        started = False
        for line in lines:
            if QUESTION_RE.match(line):
                if started and current:
                    chunks.append(current)
                current = [line]
                started = True
            elif started:
                current.append(line)
        if current:
            chunks.append(current)
        return chunks

    def _parse_chunk(self, lines: list[str]) -> ParsedQuestion | None:
        if not lines:
            return None
        content = re.sub(r'^(?:题目\s*\d+|^\d+)\s*[:：∶︰﹕\.、．]\s*', '', lines[0]).strip()

        q = ParsedQuestion(type="single_choice")
        q.content = content
        q.answer = ""

        option_lines = lines[1:]
        if not option_lines:
            return q

        labeled = {}
        unlabeled = []

        for line in option_lines:
            extracted = self._extract_labeled_options(line)
            if extracted:
                labeled.update(extracted)
            else:
                unlabeled.append(line)

        if labeled:
            max_letter = max(ord(k) for k in labeled.keys())
        else:
            max_letter = ord('D')

        total_options = max_letter - ord('A') + 1
        missing = total_options - len(labeled)

        if missing > 0 and unlabeled:
            taken = set(labeled.keys())
            available = [chr(ord('A') + i) for i in range(total_options) if chr(ord('A') + i) not in taken]
            for i, text in enumerate(unlabeled):
                if i < len(available):
                    labeled[available[i]] = text

        q.options = {k: v for k, v in sorted(labeled.items())}

        if "多选" in content:
            q.type = "multi_choice"
        elif "判断" in content:
            q.type = "true_false"
        elif "填空" in content or "_____" in content:
            q.type = "fill_blank"

        return q

    def _extract_labeled_options(self, line: str) -> dict[str, str]:
        m = re.match(r'^([A-F])\s*[\.．、)）:：]\s*(.+)$', line)
        if m:
            label = m.group(1)
            rest = m.group(2)
            sub = dict(self._find_all_options(rest))
            if sub:
                result = {}
                first_sub_pos = len(rest)
                for sub_label in sub:
                    pattern = re.compile(rf'{sub_label}\s*[\.．、)）:：]')
                    m2 = pattern.search(rest)
                    if m2:
                        first_sub_pos = min(first_sub_pos, m2.start())
                result[label] = rest[:first_sub_pos].strip() if first_sub_pos < len(rest) else rest.strip()
                result.update(sub)
                return result
            return {label: rest.strip()}
        return dict(self._find_all_options(line))

    def _find_all_options(self, text: str):
        for m in re.finditer(r'([A-F])\s*[\.．、)）:：]\s*', text):
            label = m.group(1)
            start = m.end()
            next_m = re.search(r'[A-F]\s*[\.．、)）:：]', text[start:])
            end = start + next_m.start() if next_m else len(text)
            yield label, text[start:end].strip()
