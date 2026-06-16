from .base import TextParser, ParsedQuestion
from .markdown_parser import MarkdownParser
from .excel_parser import ExcelParser
from .word_parser import WordParser
from .pdf_parser import PDFParser
from .csv_parser import CsvParser


def get_parser(filename: str):
    ext = filename.rsplit(".", 1)[-1].lower()
    parsers = {
        "md": MarkdownParser,
        "txt": MarkdownParser,
        "xlsx": ExcelParser,
        "xls": ExcelParser,
        "docx": WordParser,
        "pdf": PDFParser,
        "csv": CsvParser,
    }
    cls = parsers.get(ext)
    if cls is None:
        raise ValueError(f"不支持的文件格式: .{ext}")
    return cls()
