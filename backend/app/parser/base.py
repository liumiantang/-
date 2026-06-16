from __future__ import annotations
from typing import Optional
import re
from dataclasses import dataclass, field

TYPE_MAP = {
    "单选题": "single_choice",
    "多选题": "multi_choice",
    "判断题": "true_false",
    "填空题": "fill_blank",
    "简答题": "essay",
}


@dataclass
class ParsedQuestion:
    type: str
    difficulty: int = 1
    tags: list[str] = field(default_factory=list)
    content: str = ""
    options: dict[str, str] = field(default_factory=dict)
    answer: str = ""
    explanation: str = ""


class TextParser:
    """Parse plain text following the standard Markdown question format."""

    def parse(self, text: str) -> list[ParsedQuestion]:
        questions = []
        blocks = self._split_blocks(text)
        for block in blocks:
            q = self._parse_block(block)
            if q and q.content and q.answer:
                questions.append(q)
        return questions

    def _split_blocks(self, text: str) -> list[str]:
        """Split by --- separator, ignoring # title line."""
        lines = text.strip().split("\n")
        # Extract bank name from first line if it starts with '# 题库名称:'
        blocks = []
        current = []
        for line in lines:
            if re.match(r'^---\s*$', line):
                if current:
                    blocks.append("\n".join(current))
                    current = []
            else:
                current.append(line)
        if current:
            blocks.append("\n".join(current))
        return blocks

    def extract_bank_name(self, text: str) -> str:
        m = re.search(r'^#\s*题库名称[:：]\s*(.+)', text, re.MULTILINE)
        return m.group(1).strip() if m else "未命名题库"

    # ── block parser ──────────────────────────────────────────────
    def _parse_block(self, block: str) -> Optional[ParsedQuestion]:
        block = block.strip()
        if not block or block.startswith("# "):
            return None

        q = ParsedQuestion(type="single_choice")

        # ── type line: [单选题] 难度:2 标签:OS,进程 ──
        type_m = re.match(r'^\[(.+?)\]\s*(?:难度[:：](\d))?\s*(?:标签[:：](.+))?\s*$', block.split("\n")[0])
        if type_m:
            q.type = TYPE_MAP.get(type_m.group(1), "single_choice")
            if type_m.group(2):
                q.difficulty = int(type_m.group(2))
            if type_m.group(3):
                q.tags = [t.strip() for t in type_m.group(3).split(",") if t.strip()]

        # ── Q: content ──
        q_m = re.search(r'^Q[:：]\s*(.+)$', block, re.MULTILINE)
        if q_m:
            q.content = q_m.group(1).strip()

        # ── options A: B: C: D: ... ──
        option_lines = re.findall(r'^([A-H])[:：]\s*(.+)$', block, re.MULTILINE)
        if option_lines:
            q.options = {k.strip(): v.strip() for k, v in option_lines}

        # ── 答案: / 正确答案: ──
        a_m = re.search(r'^(?:正确)?答案[:：]\s*(.+)$', block, re.MULTILINE)
        if a_m:
            q.answer = a_m.group(1).strip()

        # ── 解析: (支持多行) ──
        e_m = re.search(r'^解析[:：]\s*(.+)', block, re.MULTILINE)
        if e_m:
            # Collect explanation starting from match, allowing continuation lines
            expl_start = e_m.start()
            expl_lines = []
            for line in block[expl_start:].split('\n'):
                stripped = line.strip()
                # Stop at next labeled section
                if re.match(r'^(?:Q[:：]|[A-H][:：]|答案[:：]|正确|解析[:：]|\[)', stripped) and expl_lines:
                    break
                if stripped:
                    expl_lines.append(stripped)
            # Remove the "解析：" prefix from first line
            if expl_lines:
                expl_lines[0] = re.sub(r'^解析[:：]\s*', '', expl_lines[0])
            q.explanation = '\n'.join(expl_lines).strip()

        return q
