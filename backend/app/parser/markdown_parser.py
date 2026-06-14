from .base import TextParser, ParsedQuestion


class MarkdownParser:
    def parse_file(self, filepath: str) -> list[ParsedQuestion]:
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
        return TextParser().parse(text)

    def extract_bank_name(self, filepath: str) -> str:
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
        return TextParser().extract_bank_name(text)
