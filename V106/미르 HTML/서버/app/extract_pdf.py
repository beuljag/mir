"""Separate PDF parser process. No network and no document execution."""
from io import BytesIO
import json
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


if __name__ == "__main__":
    try:
        content = sys.stdin.buffer.read(10_000_001)
        if len(content) > 10_000_000:
            raise ValueError("DOCUMENT_TOO_LARGE")
        result = extract(content)
        sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
    except Exception as exc:
        sys.stdout.buffer.write(json.dumps({"error": type(exc).__name__}).encode())
        sys.exit(1)
