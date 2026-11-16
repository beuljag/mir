"""Separate PDF parser process. No network and no document execution."""
from io import BytesIO
import json
import math
import sys

from pypdf import PdfReader


def extract(content):
    reader = PdfReader(BytesIO(content), strict=False)
    if reader.is_encrypted:
        raise ValueError("ENCRYPTED_PDF_UNSUPPORTED")
    total = len(reader.pages)
    pages = []
    for index in range(min(total, 40)):
        page = reader.pages[index]
        text = page.extract_text(extraction_mode="layout") or ""
        pages.append({"page": index + 1, "text": text[:40000]})
    metadata = reader.metadata or {}
    return {"pages": pages, "total_pages": total, "truncated": total > 40,
            "title": str(metadata.get("/Title", ""))[:300], "document_date": str(metadata.get("/ModDate", ""))[:100]}


def render_page(content, number):
    from pypdfium2 import PdfDocument

    if not 1 <= number <= 40:
        raise ValueError("PDF_PAGE_OUT_OF_RANGE")
    with PdfDocument(content) as document:
        if number > len(document):
            raise ValueError("PDF_PAGE_OUT_OF_RANGE")
        page = document[number - 1]
        width, height = page.get_size()
        if not all(math.isfinite(side) and side > 0 for side in (width, height)):
            raise ValueError("INVALID_PDF_PAGE_SIZE")
        bitmap = page.render(scale=min(4, 1700 / max(width, height)))
        png = BytesIO()
        bitmap.to_pil().save(png, 'PNG')
        return png.getvalue()


if __name__ == "__main__":
    try:
        content = sys.stdin.buffer.read(10_000_001)
        if len(content) > 10_000_000:
            raise ValueError("DOCUMENT_TOO_LARGE")
        if len(sys.argv) == 3 and sys.argv[1] == "--render-page":
            sys.stdout.buffer.write(render_page(content, int(sys.argv[2])))
        else:
            result = extract(content)
            sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
    except Exception as exc:
        sys.stdout.buffer.write(json.dumps({"error": type(exc).__name__}).encode())
        sys.exit(1)
