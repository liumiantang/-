from .base import TextParser, ParsedQuestion


class PDFParser:
    def parse_file(self, filepath: str) -> list[ParsedQuestion]:
        import pdfplumber

        lines = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    lines.append(text)

        text = "\n".join(lines)
        return TextParser().parse(text)

    def extract_bank_name(self, filepath: str) -> str:
        import pdfplumber

        with pdfplumber.open(filepath) as pdf:
            text = "\n".join(p.extract_text() or "" for p in pdf.pages)
        return TextParser().extract_bank_name(text)
