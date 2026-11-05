"""
Text extraction from PDF / DOCX / TXT / MD / CSV / JSON files.

Uses:
- pypdf (lightweight, pure-python) for PDF
- python-docx for DOCX
- plain decode for text formats

All extractors raise `ExtractionError` on failure — the LangGraph node
catches it and writes it into state["error"].
"""

import io
import json
import csv
from typing import Tuple, Dict, Any

from app.core.logging import get_logger

logger = get_logger("rag_extractor")


class ExtractionError(Exception):
    pass


def extract_text(
    file_bytes: bytes,
    file_name: str,
    mime_type: str | None = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Returns (plain_text, meta) where meta captures parser + page count etc.
    """
    name = (file_name or "").lower()
    ext = "." + name.rsplit(".", 1)[-1] if "." in name else ""

    if ext == ".pdf" or (mime_type and "pdf" in mime_type):
        return _extract_pdf(file_bytes, file_name)
    if ext == ".docx" or (mime_type and "wordprocessingml" in mime_type):
        return _extract_docx(file_bytes, file_name)
    if ext == ".doc":
        raise ExtractionError(
            "Legacy .doc files are not supported. Save as .docx and re-upload."
        )
    if ext in (".txt", ".md", ".markdown"):
        return _extract_text(file_bytes, file_name)
    if ext == ".csv":
        return _extract_csv(file_bytes, file_name)
    if ext == ".json":
        return _extract_json(file_bytes, file_name)

    # Last-resort: try text decode
    try:
        return _extract_text(file_bytes, file_name)
    except ExtractionError:
        raise ExtractionError(
            f"Unsupported file extension '{ext}'. "
            "Accepted: .pdf, .docx, .txt, .md, .csv, .json"
        )


def _extract_pdf(file_bytes: bytes, file_name: str) -> Tuple[str, Dict[str, Any]]:
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ExtractionError(
            "PDF support requires 'pypdf'. Install with: pip install pypdf"
        )
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            try:
                txt = page.extract_text() or ""
            except Exception as e:  # noqa: BLE001
                logger.warning(f"PDF page {i} extraction failed: {e}")
                txt = ""
            pages.append(txt)
        full = "\n\n".join(p.strip() for p in pages if p.strip())
        if not full.strip():
            raise ExtractionError(
                "PDF contained no extractable text (might be a scanned image). "
                "Please OCR it first, or upload the source .docx/.txt."
            )
        return full, {"parser": "pypdf", "pages": len(reader.pages)}
    except ExtractionError:
        raise
    except Exception as e:  # noqa: BLE001
        raise ExtractionError(f"PDF parsing failed: {e}")


def _extract_docx(file_bytes: bytes, file_name: str) -> Tuple[str, Dict[str, Any]]:
    try:
        import docx  # python-docx
    except ImportError:
        raise ExtractionError(
            "DOCX support requires 'python-docx'. Install with: pip install python-docx"
        )
    try:
        d = docx.Document(io.BytesIO(file_bytes))
        paras = [p.text for p in d.paragraphs if p.text and p.text.strip()]
        # Tables (optional but valuable for policy tables)
        for table in d.tables:
            for row in table.rows:
                cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
                if cells:
                    paras.append(" | ".join(cells))
        full = "\n\n".join(paras).strip()
        if not full:
            raise ExtractionError("DOCX contained no readable paragraphs.")
        return full, {
            "parser": "python-docx",
            "paragraphs": len(paras),
            "tables": len(d.tables),
        }
    except ExtractionError:
        raise
    except Exception as e:  # noqa: BLE001
        raise ExtractionError(f"DOCX parsing failed: {e}")


def _extract_text(file_bytes: bytes, file_name: str) -> Tuple[str, Dict[str, Any]]:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return file_bytes.decode(enc), {"parser": "text", "encoding": enc}
        except UnicodeDecodeError:
            continue
    raise ExtractionError("Could not decode text file with UTF-8/UTF-16/Latin-1.")


def _extract_csv(file_bytes: bytes, file_name: str) -> Tuple[str, Dict[str, Any]]:
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise ExtractionError("CSV file was empty.")
    header = rows[0]
    # Emit natural-language lines so the chunker + embedder have rich content
    lines = [f"CSV file: {file_name}", f"Columns: {', '.join(header)}", ""]
    for r in rows[1:501]:  # cap at 500 rows to keep embeddings bounded
        pairs = [f"{h}={v}" for h, v in zip(header, r) if v]
        if pairs:
            lines.append("; ".join(pairs))
    return "\n".join(lines), {"parser": "csv", "rows": len(rows) - 1}


def _extract_json(file_bytes: bytes, file_name: str) -> Tuple[str, Dict[str, Any]]:
    try:
        text = file_bytes.decode("utf-8")
        data = json.loads(text)
        # Pretty-print and truncate
        pretty = json.dumps(data, indent=2, ensure_ascii=False)
        if len(pretty) > 200_000:
            pretty = pretty[:200_000] + "\n... (truncated)"
        return pretty, {"parser": "json", "size": len(text)}
    except Exception as e:  # noqa: BLE001
        raise ExtractionError(f"JSON parsing failed: {e}")