#!/usr/bin/env python3
import json
import sys


def clean_cell(value):
    if value is None:
        return ""
    return " ".join(str(value).split())


def table_to_markdown(rows):
    cleaned = [[clean_cell(cell) for cell in row] for row in rows if row]
    if not cleaned:
        return ""

    width = max(len(row) for row in cleaned)
    normalized = [row + [""] * (width - len(row)) for row in cleaned]

    header = normalized[0]
    separator = ["---"] * width
    body = normalized[1:] if len(normalized) > 1 else []

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(separator) + " |",
    ]
    for row in body:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def extract_with_pymupdf(path):
    import fitz  # type: ignore

    doc = fitz.open(path)
    pages_text = []
    total_tables = 0

    for page_index, page in enumerate(doc, start=1):
        page_text = (page.get_text("text") or "").strip()
        segments = [f"[Page {page_index}]"]
        if page_text:
            segments.append(page_text)

        table_finder = page.find_tables()
        table_count = len(table_finder.tables)
        total_tables += table_count
        if table_count:
            segments.append(f"[Detected Tables: {table_count}]")
            for table_index, table in enumerate(table_finder.tables, start=1):
                rows = table.extract()
                markdown = table_to_markdown(rows)
                if markdown:
                    segments.append(f"[Table {page_index}.{table_index}]")
                    segments.append(markdown)

        pages_text.append("\n\n".join(segment for segment in segments if segment))

    return "\n\n".join(pages_text), "PyMuPDF", len(doc), total_tables


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing pdf path"}))
        sys.exit(1)

    path = sys.argv[1]
    try:
        text, engine, pages, table_count = extract_with_pymupdf(path)
        cleaned = (text or "").strip()
        print(
            json.dumps(
                {
                    "ok": True,
                    "engine": engine,
                    "pages": pages,
                    "table_count": table_count,
                    "text": cleaned,
                }
            )
        )
        return
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        sys.exit(2)


if __name__ == "__main__":
    main()
