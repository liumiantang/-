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
OPTION_LABELED = re.compile(r'([A-H])\s*[\.．、)）:：]')

# Global EasyOCR reader — initialized once and cached
_easyocr_reader = None


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

        # Fallback: try to find questions and options in free-form text
        fallback = self._parse_fallback(text)
        if fallback:
            return fallback

        return []

    def extract_bank_name(self, filepath: str) -> str:
        ext = filepath.rsplit(".", 1)[-1].lower()
        text = self._extract_text(filepath, ext)
        first_line = text.strip().split("\n")[0].strip()
        # Only strip markdown heading markers, keep digits
        first_line = re.sub(r'^#+\s*', '', first_line)
        return first_line[:200] if len(first_line) > 3 else "未命名题库"

    def _extract_text(self, filepath: str, ext: str) -> str:
        if ext in ("md", "txt"):
            # Try common Chinese encodings first
            for encoding in ("utf-8", "gbk", "gb2312", "utf-8-sig"):
                try:
                    with open(filepath, "r", encoding=encoding) as f:
                        return f.read()
                except (UnicodeDecodeError, UnicodeError):
                    continue
            # Final fallback: replace undecodable chars
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
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
            text = self._extract_pdf_text(filepath)
            # EasyOCR already produces clean output — skip aggressive _clean_pdf_text
            if getattr(self, '_used_easyocr', False):
                return self._clean_easyocr_text(text)
            return self._clean_pdf_text(text)
        return ""

    def _extract_pdf_text(self, filepath: str) -> str:
        """Extract text from PDF. Tries pdfplumber → PyPDF2 → EasyOCR → Tesseract."""
        import pdfplumber
        self._used_easyocr = False

        # 1. pdfplumber
        try:
            with pdfplumber.open(filepath) as pdf:
                pages = []
                for p in pdf.pages:
                    t = p.extract_text()
                    if t and t.strip():
                        pages.append(t.strip())
                if pages:
                    total_chars = sum(len(p) for p in pages)
                    avg_chars = total_chars / len(pages)
                    # If average chars per page < 200, it's likely just watermarks
                    # (a real text-based PDF page has hundreds of characters).
                    # Fall through to OCR for scanned/image-based PDFs.
                    if avg_chars >= 200:
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
                avg_chars = total_chars / len(pages)
                if avg_chars >= 200:
                    return "\n\n".join(pages)
        except Exception:
            pass

        # 3. EasyOCR for scanned/image-based PDFs (better math & Chinese recognition)
        ocr_text = self._easyocr_pdf(filepath)
        if ocr_text.strip():
            return ocr_text

        # 4. Tesseract OCR fallback
        ocr_text = self._ocr_pdf(filepath)
        if ocr_text.strip():
            return ocr_text

        return ""

    def _easyocr_pdf(self, filepath: str) -> str:
        """OCR using EasyOCR — better at Chinese text and math symbol recognition.

        Uses position-based spatial sorting: text blocks are sorted top-to-bottom,
        left-to-right, then grouped into lines based on vertical proximity.
        This preserves the natural reading order of exam documents with
        multi-column layouts and interspersed formulas.
        """
        global _easyocr_reader
        import numpy as np

        try:
            if _easyocr_reader is None:
                import easyocr
                _easyocr_reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)

            import fitz
            from PIL import Image
            import io

            doc = fitz.open(filepath)
            pages_text = []

            for i in range(len(doc)):
                page = doc[i]
                pix = page.get_pixmap(dpi=200)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                arr = np.array(img)
                results = _easyocr_reader.readtext(arr)

                # Filter low-confidence and collect with positions
                blocks = []
                for r in results:
                    bbox, text, conf = r
                    if conf <= 0.3 or not text.strip():
                        continue
                    # bbox is [[x1,y1],[x2,y1],[x2,y2],[x1,y2]] (clockwise from top-left)
                    y_center = (bbox[0][1] + bbox[2][1]) / 2.0
                    x_left = bbox[0][0]
                    blocks.append((y_center, x_left, text.strip()))

                if not blocks:
                    continue

                # Sort blocks: top-to-bottom, then left-to-right
                blocks.sort(key=lambda b: (b[0], b[1]))

                # Group into lines: blocks within 12px vertical distance are on same line
                LINE_Y_TOLERANCE = 12.0
                lines = []
                current_line = [blocks[0]]
                for block in blocks[1:]:
                    if abs(block[0] - current_line[-1][0]) <= LINE_Y_TOLERANCE:
                        current_line.append(block)
                    else:
                        lines.append(current_line)
                        current_line = [block]
                if current_line:
                    lines.append(current_line)

                # Within each line, sort left-to-right and join with spaces
                page_lines = []
                for line_blocks in lines:
                    line_blocks.sort(key=lambda b: b[1])  # sort by x_left
                    joined = " ".join(b[2] for b in line_blocks)
                    page_lines.append(joined)

                if page_lines:
                    pages_text.append("\n".join(page_lines))

            doc.close()
            if pages_text:
                self._used_easyocr = True
                return "\n\n".join(pages_text)
            return ""
        except Exception:
            return ""

    def _ocr_pdf(self, filepath: str) -> str:
        """OCR a scanned PDF using Tesseract via pymupdf rendering."""
        import os
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        # Point to user-writable tessdata with Chinese language pack
        os.environ["TESSDATA_PREFIX"] = r"C:\Users\24525\tessdata"

        try:
            import fitz
            from PIL import Image
            import io

            doc = fitz.open(filepath)
            pages_text = []

            for i in range(len(doc)):
                page = doc[i]
                pix = page.get_pixmap(dpi=250)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                text = pytesseract.image_to_string(img, lang="chi_sim+eng", config="--psm 6")
                if text and text.strip():
                    pages_text.append(text.strip())

            doc.close()
            return "\n\n".join(pages_text)
        except Exception:
            return ""

    def _clean_easyocr_text(self, text: str) -> str:
        """Minimal cleanup for EasyOCR output — preserves text block structure."""
        import re

        # Remove null bytes
        text = text.replace("\x00", "")
        # Normalize line endings
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Remove repeated watermark/header lines (same line appearing many times)
        lines = text.split("\n")
        seen = {}
        cleaned = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                cleaned.append(line)
                continue
            seen[stripped] = seen.get(stripped, 0) + 1
            # Keep the line if it appears <= 3 times (headers appear on every page)
            if seen[stripped] <= 3:
                cleaned.append(line)
        text = "\n".join(cleaned)
        # Collapse 3+ blank lines into 2
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text

    def _clean_pdf_text(self, text: str) -> str:
        """Clean up PDF extraction artifacts to make text parseable."""
        import re

        # Remove form feed characters
        text = text.replace("\f", "\n")

        # Remove null bytes
        text = text.replace("\x00", "")

        # Remove carriage returns
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Collapse 3+ newlines into max 2
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Remove isolated page numbers: 1-3 digits alone on a line, surrounded by blank lines.
        # Only matches when separated by blank lines — preserves numeric answers that
        # are adjacent to question/answer content (e.g. fill-in-answer "42" on its own
        # line directly under the question text).
        text = re.sub(r'(?<=\n\n)\d{1,3}(?=\n\n)', '', text)

        # Remove spaces between CJK characters (OCR artifact: "国 家" → "国家")
        # Use plain space, NOT \s — \s matches \n and would destroy blank line separators
        text = re.sub(r'(?<=[一-鿿　-〿＀-￯])[ \t]+(?=[一-鿿　-〿＀-￯])', '', text)
        # Remove spaces before Chinese/wide punctuation
        text = re.sub(r'[ \t]+([，。！？、：；）\)】」』》])', r'\1', text)

        # Remove OCR quote artifacts (scanned PDFs often insert stray quote marks)
        # These appear around answer text like: 公安机关 " 国家安全机关
        # U+0022=straight quote, U+201C=left curly, U+201D=right curly, U+FF02=fullwidth
        OCR_QUOTES = r'["“”„‟＂]'
        text = re.sub(OCR_QUOTES + r'\s*' + OCR_QUOTES, '', text)  # empty quote pairs
        text = re.sub(r'(?<=[一-鿿])[ \t]*' + OCR_QUOTES + r'[ \t]*(?=[一-鿿])', '', text)

        # Normalize various dot/separator characters used as question number separators
        text = re.sub(r'[．﹒｡]\s*', '. ', text)

        # Fix broken lines: merge continuation lines that are part of the same sentence.
        # Preserve blank lines (they separate questions from fill-in-the-blank answers).
        lines = text.split("\n")
        merged = []
        prev_blank = False
        for line in lines:
            line = line.strip()
            if not line:
                merged.append("")
                prev_blank = True
                continue
            # After a blank line: always start a new line (likely a fill-in answer)
            if prev_blank:
                merged.append(line)
                prev_blank = False
                continue
            # Merge continuation line if previous line doesn't end with sentence-ending
            # punctuation and current line doesn't look like a new question/option/answer
            if merged and merged[-1] \
                    and not re.search(r'[。！？\)】」』》][ \t]*$', merged[-1]) \
                    and not re.match(r'^\d+[\.、．\s]', line) \
                    and not re.match(r'^[A-H][\.、．)）:：]', line) \
                    and not re.match(r'^(?:正确)?答案', line) \
                    and not re.match(r'^[一二三四五六七八九十]、', line):
                merged[-1] += line
            else:
                merged.append(line)

        return "\n".join(merged)

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

            # Sub-section header: "1.1" or "1.1 Title" — only skip if it looks like a
            # short section title (≤12 chars after the number), not a full question
            ss_match = re.match(r'^\d+\.\d+\s+(.+)', line)
            if ss_match:
                after_num = ss_match.group(1)
                # Short title → section header to skip
                if len(after_num) <= 12 and not re.search(r'[。？！,，]', after_num):
                    continue
                # Longer content → treat as a question (don't skip)

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
            opt_m = re.match(r'^([A-H])\s*[\.、．)）]\s*(.+)$', line)
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
        if not section_type:
            if q.answer and not opts:
                q.type = "fill_blank"
            elif opts:
                vals = list(opts.values())
                if all(v in ('正确', '错误', '对', '错') for v in vals):
                    q.type = "true_false"
                elif len(q.answer.replace(" ", "")) > 1 and all(c in 'ABCDEFGH' for c in q.answer.upper().replace(" ", "")):
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

        # Type detection from content — only when keywords indicate the section type.
        # Be conservative: "判断" alone is too common in Chinese text, so only
        # classify as true_false when options actually look like true/false answers.
        if "多选" in content and q.options:
            q.type = "multi_choice"
        elif ("判断题" in content or "判断" in content) and q.options:
            vals = list(q.options.values())
            if all(v in ('正确', '错误', '对', '错') for v in vals):
                q.type = "true_false"
        elif ("填空" in content or "_____" in content) and not q.options:
            q.type = "fill_blank"

        return q

    def _extract_labeled_options(self, line: str) -> dict[str, str]:
        m = re.match(r'^([A-H])\s*[\.．、)）:：]\s*(.+)$', line)
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
        for m in re.finditer(r'([A-H])\s*[\.．、)）:：]\s*', text):
            label = m.group(1)
            start = m.end()
            next_m = re.search(r'[A-H]\s*[\.．、)）:：]', text[start:])
            end = start + next_m.start() if next_m else len(text)
            yield label, text[start:end].strip()

    # ── Fallback parser for unstructured PDF text ──────────────

    def _parse_fallback(self, text: str) -> list[ParsedQuestion]:
        """Heuristic parser for free-form / OCR text. Finds question-like blocks.

        Handles:
        - Fill-in-the-blank: question line → blank line → answer line
        - Multiple-choice: questions with A/B/C/D options on separate lines
        - Inline answers in multiple-choice: "…建立健全 ( D ) 制度"
        - Section transitions: 一、填空题… 二、单项选择题…
        """
        questions = []
        lines = text.strip().split("\n")
        current_block: dict = {"content": "", "options": {}, "answer": "", "extra_lines": []}
        in_options = False

        # Section type tracking — updated as we parse headers
        is_fill_section = False
        is_multi_section = False
        is_single_section = False
        is_tf_section = False

        q_pattern = re.compile(r'^(\d+)[\.。、．，,:\s\)]{1,4}')
        # Option label: case-insensitive, matches A. B、 C： etc (also handles OCR lowercase)
        OPT_LABEL = re.compile(r'([A-Ha-h])[\.．、)）:：]\s*')

        # Inline answer patterns — flexible to handle OCR artifacts:
        # (D) （D） ( D ) ( _C) (“B”) (“B》) ( ABCD) etc
        INLINE_ANS = re.compile(
            r'[\(（]'            # opening paren
            r'[^A-Ha-h\)）]{0,6}' # optional junk (_, space, quote, Chinese bracket)
            r'([A-Ha-h]{1,4})'   # capture 1-4 answer letters (handles multi-choice ABCD)
            r'[^\)）]{0,4}'      # optional trailing junk
            r'[\)）》]?'          # optional closing paren
        )

        # True/false inline answer: ( 对 ), ( 错 , explanation), (错)
        TF_ANS = re.compile(r'[\(（〔]\s*([对错])\s*[，,)]')

        def _flush_block():
            """Save current block as a question after final cleanup."""
            nonlocal current_block, in_options
            if not current_block["content"]:
                return
            content = current_block["content"]

            # Try to extract inline answer from content
            if not current_block["answer"] and not is_fill_section:
                m = INLINE_ANS.search(content)
                if m:
                    current_block["answer"] = m.group(1).upper()
                    # Remove the inline marker from content
                    content = INLINE_ANS.sub('( )', content, count=1)
                    current_block["content"] = content

            # True/false section: extract ( 对 ) or ( 错 ) from content
            if not current_block["answer"] and is_tf_section:
                m = TF_ANS.search(content)
                if m:
                    tf_map = {'对': '正确', '错': '错误'}
                    current_block["answer"] = tf_map.get(m.group(1), m.group(1))
                    # Remove the answer marker from content
                    content = TF_ANS.sub('', content, count=1).strip().rstrip(')）')
                    current_block["content"] = content
                    current_block['section_type'] = 'true_false'

            # If no options and no answer, try extra_lines
            if not current_block["options"] and not current_block["answer"]:
                if current_block["extra_lines"]:
                    for extra in current_block["extra_lines"]:
                        extra = extra.strip().strip('"').strip()
                        if extra:
                            current_block["answer"] = extra
                            break

            # Clean OCR artifacts from answer: quotes, trailing orphan digits
            if current_block["answer"]:
                ans = current_block["answer"]
                # Remove OCR stray quote characters: "=straight, “/d=curly, ＂=fullwidth
                ans = re.sub(r'\s*["“”＂]\s*', ' ', ans)
                ans = ans.strip()
                # Remove trailing orphan digits only when preceded by CJK text
                # (OCR artifact: "义务 5" → "义务"). Preserves pure numeric answers ("42").
                ans = re.sub(r'(?<=[一-鿿])\s+\d{1,2}$', '', ans)
                current_block["answer"] = ans

            # If content has trailing underscore prefix (blank marker), clean it
            content = current_block["content"]
            content = re.sub(r'\b_\b', '_____', content)
            current_block["content"] = content

            questions.append(self._finalize_block(current_block))
            current_block = {"content": "", "options": {}, "answer": "", "extra_lines": []}
            in_options = False

        def _extract_options(line: str) -> dict[str, str]:
            """Extract all option labels from a line (handles multiple per line: 'A. xxx B. yyy')."""
            result = {}
            for m in OPT_LABEL.finditer(line):
                label = m.group(1).upper()
                start = m.end()
                # Find next option label or end of string
                next_m = OPT_LABEL.search(line, start)
                end = next_m.start() if next_m else len(line)
                result[label] = line[start:end].strip()
            return result

        for line in lines:
            line = line.strip()

            # Section headers — update type tracking
            section_m = re.match(r'^[一二三四五六七八九十]、\s*(.+)', line)
            if section_m:
                sec_name = section_m.group(1)
                if "填空" in sec_name:
                    is_fill_section = True
                    is_multi_section = False
                    is_single_section = False
                    is_tf_section = False
                elif "多选" in sec_name or "多项" in sec_name:
                    is_fill_section = False
                    is_multi_section = True
                    is_single_section = False
                    is_tf_section = False
                elif "单选" in sec_name or "选择" in sec_name:
                    is_fill_section = False
                    is_multi_section = False
                    is_single_section = True
                    is_tf_section = False
                elif "判断" in sec_name:
                    is_fill_section = False
                    is_multi_section = False
                    is_single_section = False
                    is_tf_section = True
                # Flush any pending question before section change
                if current_block["content"]:
                    _flush_block()
                continue

            # Skip page artifacts (hierarchical numbering like 1.1.1)
            if re.match(r'^\d+\.\d+', line) and not q_pattern.match(line):
                continue

            if not line:
                # Blank line: separator between question and answer/options
                if is_fill_section and current_block["content"] and current_block["answer"]:
                    _flush_block()
                elif current_block["options"]:
                    _flush_block()
                continue

            # Question start: number prefix like "1.", "2、", "3．"
            qm = q_pattern.match(line)
            if qm:
                _flush_block()
                content = q_pattern.sub("", line).strip()
                # Strip leading comma/spaces from OCR artifacts (e.g. "9., 国家..." → "国家...")
                content = re.sub(r'^[,，]\s*', '', content)
                current_block["content"] = content
                continue

            # Option: try to extract all options from the line
            if current_block["content"]:
                opts_found = _extract_options(line)
                if opts_found:
                    current_block["options"].update(opts_found)
                    in_options = True
                    continue

            # Explicit answer line
            ans_m = re.match(r'^(?:正确)?答案[:：]\s*(.+)', line)
            if ans_m and current_block["content"]:
                current_block["answer"] = ans_m.group(1).strip()
                _flush_block()
                continue

            # Unrecognized line — could be content continuation or answer
            if current_block["content"]:
                if in_options and current_block["options"]:
                    # Continuation of last option text
                    last_key = sorted(current_block["options"].keys())[-1]
                    current_block["options"][last_key] += " " + line
                elif is_fill_section and not current_block["options"]:
                    # In fill-blank sections, standalone lines after question content are answers
                    current_block["answer"] = line
                elif not current_block["options"] and not current_block["answer"]:
                    # Content continuation (sentence broken across lines by OCR)
                    current_block["content"] += line
                else:
                    current_block["content"] += " " + line

        _flush_block()
        return questions
