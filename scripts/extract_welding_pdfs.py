"""Extrae los PDFs del curso de soldadura a la base de contenido en output/.

No modifica los PDF originales. Si existe output/_review/alts.json, aplica
descripciones visuales sobre las imágenes.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import unicodedata
from pathlib import Path

import pymupdf
from PIL import Image
from pypdf import PdfReader

ROOT = Path(r"C:\Users\0Anth\OneDrive\Escritorio\Santiago")
OUT = ROOT / "output"

SPECS = [
    {
        "match": "presentacion",
        "id": "documento-001",
        "slug": "presentacion-introduccion",
    },
    {"match": "seguridad", "id": "documento-002", "slug": "seguridad"},
    {"match": "terminologia", "id": "documento-003", "slug": "terminologia"},
    {"match": "simbologia", "id": "documento-004", "slug": "simbologia"},
    {"match": "oxiacetileno", "id": "documento-005", "slug": "oxiacetileno"},
    {"match": "smaw", "id": "documento-006", "slug": "smaw"},
    {"match": "gmaw", "id": "documento-007", "slug": "gmaw"},
]

BULLET_CHARS = "\u2794\u27a4\u25ba\u25cf\u2022\u25aa\u2023\u2043\u2219➢►●▪"
BULLET_RE = re.compile(rf"^(?:[{BULLET_CHARS}]\s*|[-–—]\s+)")
INLINE_BULLET_RE = re.compile(rf"\s*(?=[{BULLET_CHARS}])")
ORDER_RE = re.compile(r"^(\d+)\s*[\.\)]\s+")
URL_RE = re.compile(r"https?://[^\s<>]+|www\.[^\s<>]+", re.I)
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)\d{3,4}[\s-]?\d{4}")


def slugify(text: str, limit: int = 60) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return (text[:limit].strip("-")) or "imagen"


def norm_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_pdf_date(raw: str | None) -> str | None:
    if not raw:
        return None
    m = re.search(r"(\d{4})(\d{2})(\d{2})", raw)
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"


def unavailable(reason: str) -> dict:
    return {
        "value": None,
        "confidence": "low",
        "source": "unavailable",
        "reason": reason,
    }


def load_alts() -> dict:
    review = OUT / "_review"
    if not review.exists():
        return {}
    merged = {}
    for path in sorted(review.glob("alts*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for key, value in data.items():
            if str(key).startswith("_") or not isinstance(value, dict):
                continue
            merged[key] = value
    return merged


def match_spec(name: str) -> dict:
    folded = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    for spec in SPECS:
        if spec["match"] in folded:
            return spec
    raise SystemExit(f"PDF sin ficha: {name}")


def collect_lines(page) -> list[dict]:
    data = page.get_text("dict")
    lines = []
    for block in data["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            spans = line["spans"]
            if not spans:
                continue
            text = norm_space("".join(s["text"] for s in spans))
            if not text:
                continue
            bb = line["bbox"]
            lines.append(
                {
                    "text": text,
                    "size": max(s["size"] for s in spans),
                    "italic": all(bool(s["flags"] & 2) for s in spans),
                    "x0": bb[0],
                    "y0": bb[1],
                    "x1": bb[2],
                    "y1": bb[3],
                }
            )
    return lines


def cluster_rows(lines: list[dict], y_tol: float = 8.0) -> list[dict]:
    rows: list[dict] = []
    for line in sorted(lines, key=lambda item: (item["y0"], item["x0"])):
        same_band = rows and abs(line["y0"] - rows[-1]["y0"]) <= y_tol
        same_size = rows and abs(line["size"] - rows[-1]["parts"][0]["size"]) <= 4
        if same_band and same_size:
            rows[-1]["parts"].append(line)
        else:
            rows.append({"y0": line["y0"], "parts": [line]})
    clustered = []
    for row in rows:
        parts = sorted(row["parts"], key=lambda item: item["x0"])
        text = norm_space(" ".join(part["text"] for part in parts))
        pieces = [piece.strip() for piece in INLINE_BULLET_RE.split(text) if piece.strip()]
        if len(pieces) < 2:
            pieces = [text]
        base_y = min(part["y0"] for part in parts)
        for offset, piece in enumerate(pieces):
            clustered.append(
                {
                    "text": piece,
                    "size": max(part["size"] for part in parts),
                    "italic": all(part["italic"] for part in parts),
                    "x0": min(part["x0"] for part in parts),
                    "x1": max(part["x1"] for part in parts),
                    "y0": base_y + offset * 0.01,
                    "y1": max(part["y1"] for part in parts),
                }
            )
    return clustered


def strip_marker(text: str) -> tuple[str, str | None]:
    if BULLET_RE.match(text):
        return BULLET_RE.sub("", text).strip(), "ul"
    ordered = ORDER_RE.match(text)
    if ordered:
        return ORDER_RE.sub("", text).strip(), "ol"
    return text, None


def cover_title(rows: list[dict]) -> str:
    kept = [
        row["text"]
        for row in rows
        if row["text"].lower() != "soldadura" and not row["text"].lower().startswith("clase no")
    ]
    if not kept:
        return norm_space(" ".join(row["text"] for row in rows))
    parts = []
    for line in kept:
        if parts and not parts[-1].endswith(":"):
            parts.append("—")
        parts.append(line)
    return norm_space(" ".join(parts))


def split_title_body(rows: list[dict], page_no: int) -> tuple[str, list[dict]]:
    if not rows:
        return "", []
    if page_no == 1:
        return cover_title(rows), []
    credit = rows[0]["text"].lower().startswith("imagen tomada")
    if credit:
        return "", rows
    body_start = 0
    first = rows[0]
    if first["size"] >= 32 and strip_marker(first["text"])[1] is None:
        body_start = 1
        for index in range(1, len(rows)):
            row = rows[index]
            if strip_marker(row["text"])[1] or row["size"] <= first["size"] - 4:
                break
            if row["y0"] - rows[index - 1]["y1"] > first["size"] * 1.3 and row["size"] < first["size"]:
                break
            body_start = index + 1
    title = norm_space(" ".join(row["text"] for row in rows[:body_start]))
    return title, rows[body_start:]


def join_body(rows: list[dict]) -> list[dict]:
    blocks: list[dict] = []
    for row in rows:
        text, kind = strip_marker(row["text"])
        if not text:
            continue
        if blocks:
            prev = blocks[-1]
            gap = row["y0"] - prev["y0"]
            same_size = abs(row["size"] - prev["size"]) <= 2
            continues = (
                kind is None
                and prev["kind"] in {None, "ul", "ol"}
                and same_size
                and 0 < gap < max(prev["size"], row["size"]) * 1.55
                and row["x0"] >= prev["x0"] - 15
            )
            if continues:
                joiner = "" if prev["text"].endswith("-") else " "
                if prev["text"].endswith("-"):
                    prev["text"] = prev["text"][:-1] + text
                else:
                    prev["text"] = norm_space(prev["text"] + joiner + text)
                prev["y0"] = row["y0"]
                prev["y1"] = row["y1"]
                prev["x1"] = max(prev.get("x1", row["x0"]), row.get("x1", row["x0"]))
                continue
        blocks.append(
            {
                "text": text,
                "kind": kind,
                "size": row["size"],
                "italic": row["italic"],
                    "x0": row["x0"],
                    "x1": row.get("x1", row["x0"]),
                    "y0": row["y0"],
                    "y1": row["y1"],
                }
        )
    return group_short_lines(blocks)


def group_short_lines(blocks: list[dict]) -> list[dict]:
    grouped: list[dict] = []
    index = 0
    while index < len(blocks):
        block = blocks[index]
        if block["kind"] is None and len(block["text"]) <= 70:
            end = index
            while (
                end + 1 < len(blocks)
                and blocks[end + 1]["kind"] is None
                and len(blocks[end + 1]["text"]) <= 70
                and abs(blocks[end + 1]["size"] - block["size"]) <= 2
            ):
                end += 1
            run = blocks[index : end + 1]
            sentence = False
            for left, right in zip(run, run[1:]):
                if left["text"][-1:] not in ".?!" and right["text"][:1].islower():
                    sentence = True
                    break
            if len(run) >= 3 and not sentence:
                grouped.append(
                    {
                        "text": "",
                        "kind": "ul",
                        "items": [item["text"] for item in run],
                        "size": block["size"],
                        "italic": False,
                        "x0": min(item["x0"] for item in run),
                        "x1": max(item.get("x1", item["x0"]) for item in run),
                        "y0": run[0]["y0"],
                        "y1": run[-1]["y1"],
                    }
                )
                index = end + 1
                continue
        grouped.append(block)
        index += 1
    return grouped


def blocks_to_content(blocks: list[dict], page_no: int, title: str) -> list[dict]:
    content = []
    index = 0
    while index < len(blocks):
        block = blocks[index]
        if block["kind"] in {"ul", "ol"} and block.get("items"):
            content.append(
                {
                    "type": "list",
                    "ordered": False,
                    "items": block["items"],
                    "page": page_no,
                    "source": "extracted",
                    "confidence": "high",
                    "_y": block["y0"],
                    "_y1": block["y1"],
                    "_x1": block.get("x1", block["x0"]),
                }
            )
            index += 1
            continue
        if block["kind"] in {"ul", "ol"}:
            kind = block["kind"]
            items = [block["text"]]
            y0 = block["y0"]
            y1 = block["y1"]
            x1 = block.get("x1", block["x0"])
            index += 1
            while index < len(blocks) and blocks[index]["kind"] == kind and not blocks[index].get("items"):
                items.append(blocks[index]["text"])
                y1 = blocks[index]["y1"]
                x1 = max(x1, blocks[index].get("x1", blocks[index]["x0"]))
                index += 1
            content.append(
                {
                    "type": "list",
                    "ordered": kind == "ol",
                    "items": items,
                    "page": page_no,
                    "source": "extracted",
                    "confidence": "high",
                    "_y": y0,
                    "_y1": y1,
                    "_x1": x1,
                }
            )
            continue
        text = block["text"]
        warning = title.upper().startswith("OJO") or text.upper().startswith("OJO")
        content.append(
            {
                "type": "warning" if warning else "quote" if block["italic"] else "paragraph",
                "text": text,
                "page": page_no,
                "source": "extracted",
                "confidence": "high",
                "_y": block["y0"],
                "_y1": block["y1"],
                "_x1": block.get("x1", block["x0"]),
            }
        )
        index += 1
    return content


def image_position(bbox, page_w: float, page_h: float) -> str:
    cx = ((bbox[0] + bbox[2]) / 2) / page_w
    cy = ((bbox[1] + bbox[3]) / 2) / page_h
    horiz = "izquierda" if cx < 0.34 else "derecha" if cx > 0.66 else "centro"
    vert = "superior" if cy < 0.34 else "inferior" if cy > 0.66 else "centro"
    return f"{vert}-{horiz}"


def is_real_table(table: list) -> bool:
    if not table or len(table) < 2:
        return False
    widths = [len(row) for row in table]
    cols = max(widths)
    if cols < 2 or cols > 6:
        return False
    if len(set(widths)) > 1:
        return False
    cells = []
    for row in table:
        for cell in row:
            cells.append("" if cell is None else norm_space(str(cell)))
    nonempty = [cell for cell in cells if cell]
    if len(nonempty) / len(cells) < 0.55:
        return False
    lengths = sorted(len(cell) for cell in nonempty)
    if lengths[len(lengths) // 2] < 3:
        return False
    first_col = [norm_space(str(row[0] or "")) for row in table[1:]]
    if first_col and all(re.fullmatch(r"\d+\)?", cell) for cell in first_col):
        return False
    return True


def clean_table(table: list) -> list[list[str]]:
    cleaned = []
    for row in table:
        cleaned.append([norm_space(str(cell)) if cell else "" for cell in row])
    return cleaned


def save_raster(doc, xref: int, dest_stem: Path) -> tuple[str, str]:
    info = doc.extract_image(xref)
    ext = info["ext"] or "png"
    raw = dest_stem.with_suffix("." + ext)
    raw.write_bytes(info["image"])
    try:
        image = Image.open(io.BytesIO(info["image"]))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
    except Exception:
        pix = pymupdf.Pixmap(doc, xref)
        if pix.n - pix.alpha > 3:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        image = Image.open(io.BytesIO(pix.tobytes("png")))
        if not raw.exists() or raw.stat().st_size == 0:
            raw = dest_stem.with_suffix(".png")
            raw.write_bytes(pix.tobytes("png"))
            ext = "png"
    webp = dest_stem.with_suffix(".webp")
    image.save(webp, "WEBP", quality=82)
    return ext, webp.name


def document_title(cover_title: str) -> str:
    parts = [part.strip(" .") for part in re.split(r"\s{2,}|(?<=\.)\s+", cover_title) if part.strip()]
    # cover_title is already a single spaced string; split known labels
    lines = [norm_space(part) for part in cover_title.split("|")]
    if len(lines) == 1:
        lines = [cover_title]
    kept = []
    for line in lines:
        if line.lower() == "soldadura":
            continue
        if line.lower().startswith("clase no"):
            continue
        kept.append(line)
    return norm_space(" ".join(kept)) or cover_title or "Soldadura"


def is_credit(text: str) -> bool:
    folded = text.lower().replace("á", "a").replace("é", "e")
    return folded.startswith("imagen tomada") or folded.startswith("imagenes tomada")


def refine_section(section: dict, images: list[dict]) -> None:
    merged = []
    for block in section["content"]:
        if (
            merged
            and block.get("type") == "paragraph"
            and merged[-1].get("type") == "paragraph"
            and not is_credit(merged[-1]["text"])
            and not is_credit(block["text"])
            and merged[-1]["text"][-1:] not in ".?!:"
            and len(block["text"]) < 90
        ):
            merged[-1]["text"] = norm_space(merged[-1]["text"] + " " + block["text"])
            continue
        if (
            merged
            and block.get("type") == "paragraph"
            and merged[-1].get("type") == "list"
            and merged[-1]["items"]
            and merged[-1]["items"][-1][-1:] not in ".?!:"
        ):
            merged[-1]["items"][-1] = norm_space(merged[-1]["items"][-1] + " " + block["text"])
            continue
        merged.append(block)

    credits = [block["text"] for block in merged if block.get("type") == "paragraph" and is_credit(block["text"])]
    body = []
    for block in merged:
        if block.get("type") == "paragraph" and is_credit(block["text"]):
            body.append({**block, "type": "caption"})
        else:
            body.append(block)
    section["content"] = body
    if credits:
        for block in section["content"]:
            if block.get("type") != "image":
                continue
            for image in images:
                if image["id"] == block["image_id"]:
                    image["caption"] = credits[-1]

    paragraphs = [block for block in section["content"] if block.get("type") == "paragraph"]
    if not section["title"] and paragraphs and len(section["content"]) > 1:
        candidate = paragraphs[0]
        short = len(candidate["text"]) <= 140
        question = candidate["text"].rstrip().endswith("?")
        only_short = len(paragraphs) == 1 and short
        if question or only_short:
            section["title"] = candidate["text"].rstrip(".")
            section["title_source"] = "leading_line"
            section["title_confidence"] = "medium"
            section["content"] = [block for block in section["content"] if block is not candidate]


def clip_text(text: str, limit: int = 180) -> str:
    text = norm_space(text)
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def first_description(sections: list[dict]) -> str:
    for section in sections:
        if section["page"] == 1:
            continue
        for block in section["content"]:
            if block["type"] in {"paragraph", "warning", "quote"} and len(block["text"]) >= 80:
                return clip_text(block["text"])
            if block["type"] == "list" and block["items"]:
                joined = ". ".join(item.rstrip(".") for item in block["items"])
                if len(joined) >= 80:
                    return clip_text(joined)
    return ""


def keywords_from(text: str) -> list[str]:
    catalog = [
        ("SMAW", "smaw"),
        ("GMAW", "gmaw"),
        ("oxiacetileno", "oxiacetileno"),
        ("electrodo", "electrodo"),
        ("arco eléctrico", "arco electrico"),
        ("gas de protección", "gas de proteccion"),
        ("simbología", "simbologia"),
        ("seguridad", "seguridad"),
        ("terminología", "terminologia"),
        ("polaridad", "polaridad"),
        ("soplete", "soplete"),
        ("acetileno", "acetileno"),
        ("argón", "argon"),
        ("EPP", "epp"),
        ("WPS", "wps"),
        ("AWS", "aws"),
        ("soldadura de filete", "filete"),
        ("ensayo no destructivo", "ensayo no destructivo"),
    ]
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    found = []
    for label, needle in catalog:
        needle_folded = unicodedata.normalize("NFKD", needle).encode("ascii", "ignore").decode().lower()
        if needle_folded in folded:
            found.append(label)
    return found


def apply_confirmed_fixes(slug, sections, tables, tbl_dir, report, filename) -> None:
    """Ajustes confirmados al mirar la lámina, no valores inventados."""
    if slug == "oxiacetileno":
        for table in tables:
            changed = False
            for row in table["rows"]:
                for index, cell in enumerate(row):
                    if cell == "___":
                        row[index] = "—"
                        changed = True
            if changed:
                table["confidence"] = "high"
                table["notes"] = "La fila R45 muestra una raya en la lámina, no un número."
                table["source"] = "extracted"
                (tbl_dir / f"{table['id']}.json").write_text(
                    json.dumps(table, ensure_ascii=False, indent=2), encoding="utf-8"
                )
    if slug == "simbologia":
        for table in tables:
            table["notes"] = (
                "Transcripción de la lámina. Conserva la grafía impresa, incluida «fluorecente» y el símbolo DTP."
            )
            (tbl_dir / f"{table['id']}.json").write_text(
                json.dumps(table, ensure_ascii=False, indent=2), encoding="utf-8"
            )
    if slug == "seguridad":
        for section in sections:
            if section["page"] != 11:
                continue
            section["content"] = [block for block in section["content"] if block.get("type") != "list"]
            table_id = "tbl-seguridad-001"
            record = {
                "id": table_id,
                "page": 11,
                "section_id": section["id"],
                "caption": "Clasificación de los gases en la lámina de cilindros",
                "headers": ["Grupo", "Gases"],
                "rows": [
                    ["Combustibles", "Acetileno. Propano. Gas natural."],
                    ["Gases inertes", "Nitrógeno. Argón. Helio."],
                    ["Comburentes", "Oxígeno."],
                    ["Gases activos", "CO2"],
                ],
                "notes": "En la lámina los cuatro grupos van en dos columnas. El texto es el de la diapositiva; la disposición se confirmó visualmente.",
                "source": "visual",
                "confidence": "high",
            }
            tables.append(record)
            (tbl_dir / f"{table_id}.json").write_text(
                json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            section["content"].append({"type": "table", "table_id": table_id, "page": 11})
        report["warnings"].append(
            {
                "file": filename,
                "page": 9,
                "issue": "El texto impreso dice «eviatr» y «acumulacion»; se conservó tal cual.",
            }
        )


def extract_document(pdf_path: Path, spec: dict, alts: dict, report: dict) -> dict:
    slug = spec["slug"]
    doc_dir = OUT / "documents" / slug
    img_dir = doc_dir / "images"
    tbl_dir = doc_dir / "tables"
    img_dir.mkdir(parents=True, exist_ok=True)
    tbl_dir.mkdir(parents=True, exist_ok=True)
    for folder in (img_dir, tbl_dir):
        for stale in folder.iterdir():
            if stale.is_file():
                stale.unlink()

    reader = PdfReader(str(pdf_path))
    meta = reader.metadata
    author_meta = None
    created_raw = None
    if meta:
        author_meta = (meta.author or "").strip() or None
        created_raw = meta.creation_date if hasattr(meta, "creation_date") else None
        if created_raw is not None and not isinstance(created_raw, str):
            created_iso = created_raw.strftime("%Y-%m-%d")
        else:
            created_iso = parse_pdf_date(str(meta.get("/CreationDate")) if meta else None)
    else:
        created_iso = None

    doc = pymupdf.open(pdf_path)
    sections = []
    images = []
    tables = []
    links = []
    contacts = []
    saved_xref: dict[int, tuple[str, str]] = {}
    image_seq = 0
    low_conf = []
    visual_pages = []
    plain_parts = []

    for page_index in range(doc.page_count):
        page = doc[page_index]
        page_no = page_index + 1
        rows = cluster_rows(collect_lines(page))
        info = page.get_image_info(xrefs=True)
        seen = set()
        page_images = []
        for item in info:
            xref = item.get("xref")
            bbox = tuple(round(v, 1) for v in item["bbox"])
            key = (xref, bbox)
            if key in seen or xref is None:
                continue
            if item["width"] < 8 or item["height"] < 8:
                continue
            seen.add(key)
            page_images.append(item)

        title, body_rows = split_title_body(rows, page_no)
        blocks = join_body(body_rows)
        content = blocks_to_content(blocks, page_no, title)
        plain = " ".join(row["text"] for row in rows)
        plain_parts.append(plain)

        for link in page.get_links():
            uri = link.get("uri")
            if uri:
                links.append(
                    {
                        "url": uri,
                        "page": page_no,
                        "source": "extracted",
                        "confidence": "high",
                    }
                )
        for match in URL_RE.findall(plain):
            links.append({"url": match, "page": page_no, "source": "extracted", "confidence": "high"})
        for match in EMAIL_RE.findall(plain):
            contacts.append(
                {"type": "email", "value": match, "page": page_no, "source": "extracted", "confidence": "high"}
            )
        for match in PHONE_RE.findall(plain):
            contacts.append(
                {
                    "type": "phone",
                    "value": match,
                    "page": page_no,
                    "source": "extracted",
                    "confidence": "medium",
                    "reason": "Patrón numérico; requiere confirmación visual",
                }
            )

        body_chars = 0
        for block in blocks:
            body_chars += len(block.get("text", ""))
            body_chars += sum(len(item) for item in block.get("items", []))
        level = 1 if page_no == 1 or (title and body_chars < 45 and len(title) <= 80 and not page_images) else 2
        if not title and not content and not page_images:
            report["warnings"].append(
                {"file": pdf_path.name, "page": page_no, "issue": "Página sin texto ni imágenes"}
            )

        section_id = f"sec-{slug}-{page_no:03d}"
        section_images = []
        for item in sorted(page_images, key=lambda img: (img["bbox"][1], img["bbox"][0])):
            image_seq += 1
            image_id = f"img-{slug}-{image_seq:03d}"
            xref = item["xref"]
            bbox = [round(v, 1) for v in item["bbox"]]
            w, h = int(item["width"]), int(item["height"])
            base_label = slugify(title) if title else f"lamina-pagina-{page_no}"
            stem_name = f"{slug}-p{page_no:02d}-{base_label}"
            if xref in saved_xref:
                webp_name, ext = saved_xref[xref]
                duplicate = True
            else:
                duplicate = False
                stem = img_dir / stem_name
                n = 2
                while stem.with_suffix(".webp").exists():
                    stem = img_dir / f"{stem_name}-{n}"
                    n += 1
                try:
                    ext, webp_name = save_raster(doc, xref, stem)
                except Exception as exc:
                    report["errors"].append(
                        {"file": pdf_path.name, "page": page_no, "image": image_id, "error": str(exc)}
                    )
                    continue
                saved_xref[xref] = (webp_name, ext)
            else_digest = hashlib.sha256((img_dir / webp_name).read_bytes()).hexdigest()[:16]

            is_logo = page_no == 1 and w <= 360 and h <= 180
            overlay = alts.get(image_id, {})
            alt = overlay.get("alt")
            confidence = overlay.get("confidence") or ("high" if alt else "low")
            if not alt:
                if title:
                    alt = f"Figura de la diapositiva «{title}» (página {page_no})."
                else:
                    alt = f"Figura de la página {page_no}."
                low_conf.append(
                    {
                        "id": image_id,
                        "page": page_no,
                        "reason": "Descripción visual todavía no revisada",
                    }
                )
            elif confidence in {"low", "medium"}:
                low_conf.append(
                    {
                        "id": image_id,
                        "page": page_no,
                        "reason": f"Descripción visual con confianza {confidence}",
                    }
                )
            kind = overlay.get("type") or ("logo" if is_logo else "fotografia")
            decorative = overlay.get("decorative", is_logo and w < 400)
            record = {
                "id": image_id,
                "source_file": pdf_path.name,
                "page": page_no,
                "position": image_position(bbox, page.rect.width, page.rect.height),
                "bbox": bbox,
                "file": f"images/{webp_name}",
                "original_format": ext,
                "width": w,
                "height": h,
                "type": kind,
                "description": overlay.get("description", alt),
                "visible_text": overlay.get("visible_text"),
                "caption": title or next((row["text"] for row in rows if row["text"].lower().startswith("imagen tomada")), None),
                "section_id": section_id,
                "relation": "Ilustra la diapositiva" if title else "Contenido principal de la diapositiva",
                "relevance": overlay.get("relevance", "low" if decorative else "high" if not title or len(plain) < 80 else "medium"),
                "contains_important_info": overlay.get("contains_important_info", not decorative),
                "decorative": decorative,
                "show_on_web": overlay.get("show_on_web", not decorative),
                "thumbnail": overlay.get("thumbnail", False),
                "hero": overlay.get("hero", False),
                "alt": "" if decorative else alt,
                "duplicate_of_xref": duplicate,
                "sha256_16": else_digest,
                "source": "visual" if image_id in alts else "inferred",
                "confidence": confidence,
            }
            if record["visible_text"] is None:
                record["visible_text"] = None
                record["visible_text_detail"] = unavailable(
                    "El texto interno de la imagen no se transcribió en esta pasada"
                ) if image_id not in alts else {"value": None, "confidence": "medium", "source": "visual", "reason": "No se distinguió texto dentro de la imagen"}
            images.append(record)
            section_images.append(record)
            content.append(
                {
                    "type": "image",
                    "image_id": image_id,
                    "page": page_no,
                    "_y": bbox[1],
                    "_x0": bbox[0],
                }
            )

        for entry in content:
            if entry["type"] != "image":
                continue
            image_x = entry.get("_x0", 0)
            for text in content:
                if text["type"] == "image":
                    continue
                y0 = text.get("_y", 0)
                y1 = text.get("_y1", y0)
                text_right = text.get("_x1", 0)
                if y0 <= entry["_y"] <= y1 and image_x > text_right - 10:
                    entry["_y"] = y1 + 0.5
        content.sort(key=lambda entry: entry["_y"])
        for entry in content:
            entry.pop("_y", None)
            entry.pop("_y1", None)
            entry.pop("_x1", None)
            entry.pop("_x0", None)

        if page_images and (len(plain) < 90 or any(not rec["decorative"] for rec in section_images)):
            visual_pages.append(page_no)
            pix = page.get_pixmap(matrix=pymupdf.Matrix(1.15, 1.15), alpha=False)
            review_dir = OUT / "_review" / "pages"
            review_dir.mkdir(parents=True, exist_ok=True)
            pix.save(str(review_dir / f"{slug}-p{page_no:02d}.jpg"))

        sections.append(
            {
                "id": section_id,
                "title": title or None,
                "level": level,
                "page": page_no,
                "content": content,
            }
        )

        if not title and plain.strip():
            report["warnings"].append(
                {
                    "file": pdf_path.name,
                    "page": page_no,
                    "issue": "Hay texto pero no se identificó un título de diapositiva",
                }
            )

    # tables via pdfplumber, stricter filter
    import pdfplumber

    with pdfplumber.open(str(pdf_path)) as plumber:
        table_seq = 0
        for page_index, plumber_page in enumerate(plumber.pages):
            found = plumber_page.extract_tables() or []
            for raw in found:
                if not is_real_table(raw):
                    report["rejected_tables"].append(
                        {"file": pdf_path.name, "page": page_index + 1, "cols": max((len(r) for r in raw), default=0), "rows": len(raw)}
                    )
                    continue
                table_seq += 1
                cleaned = clean_table(raw)
                headers = cleaned[0]
                rows = cleaned[1:]
                uncertain = any(cell in {"___", "—", "-"} or cell == "" for row in cleaned for cell in row)
                table_id = f"tbl-{slug}-{table_seq:03d}"
                section_id = f"sec-{slug}-{page_index + 1:03d}"
                record = {
                    "id": table_id,
                    "page": page_index + 1,
                    "section_id": section_id,
                    "caption": next((s["title"] for s in sections if s["page"] == page_index + 1), None),
                    "headers": headers,
                    "rows": rows,
                    "notes": "Alguna celda llegó vacía o como ___ y debe contrastarse con la lámina." if uncertain else None,
                    "source": "extracted",
                    "confidence": "medium" if uncertain else "high",
                }
                tables.append(record)
                (tbl_dir / f"{table_id}.json").write_text(
                    json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                for section in sections:
                    if section["page"] == page_index + 1:
                        section["content"].append({"type": "table", "table_id": table_id, "page": page_index + 1})

    apply_confirmed_fixes(slug, sections, tables, tbl_dir, report, pdf_path.name)

    # parent links for level-2 slides
    current_parent = None
    for section in sections:
        if section["level"] == 1:
            current_parent = section["id"]
            section["parent_id"] = None
        else:
            section["parent_id"] = current_parent

    full_text = "\n".join(plain_parts)
    cover = sections[0]["title"] if sections else ""
    # Rebuild a better title from cover page raw lines
    cover_lines = [row["text"] for row in cluster_rows(collect_lines(doc[0]))]
    title = cover_title([{"text": line} for line in cover_lines]) or document_title(cover or "")
    class_line = next((line for line in cover_lines if line.lower().startswith("clase no")), None)
    description = first_description(sections)
    if not description:
        description = title
        desc_source = "inferred"
        desc_conf = "low"
    else:
        desc_source = "extracted"
        desc_conf = "high"

    heroes = [
        img
        for img in images
        if img["page"] == 1 and img["type"] != "logo" and not img["decorative"]
    ]
    heroes.sort(key=lambda img: img["width"] * img["height"], reverse=True)
    featured = heroes[0]["file"] if heroes else (images[0]["file"] if images else None)
    if heroes:
        heroes[0]["hero"] = True
        heroes[0]["thumbnail"] = True

    tags = keywords_from(full_text + " " + title)
    # dedupe links
    dedup_links = []
    seen_links = set()
    for link in links:
        key = (link["url"], link["page"])
        if key in seen_links:
            continue
        seen_links.add(key)
        dedup_links.append(link)

    if author_meta:
        author = author_meta
        author_detail = {
            "value": author_meta,
            "confidence": "high",
            "source": "pdf_metadata",
            "reason": "Campo Author del PDF. No aparece repetido en el cuerpo de las diapositivas.",
        }
    else:
        author = None
        author_detail = unavailable("El PDF no trae autor en metadatos ni en las diapositivas.")

    for section in sections:
        refine_section(section, images)

    last_divider = None
    for section in sections:
        if section["level"] == 1 and section["page"] != 1:
            last_divider = section["title"]
            continue
        if section["title"]:
            last_divider = None
            continue
        if last_divider:
            section["title"] = last_divider
            section["title_source"] = "previous_section_divider"
            section["title_confidence"] = "medium"
            for block in section["content"]:
                if block["type"] != "image":
                    continue
                for image in images:
                    if image["id"] == block["image_id"] and not image["caption"]:
                        image["caption"] = last_divider

    report["warnings"] = [
        warning
        for warning in report["warnings"]
        if not (
            warning["file"] == pdf_path.name
            and warning["issue"].startswith("Hay texto")
            and any(section["page"] == warning["page"] and section["title"] for section in sections)
        )
    ]

    subcategories = []
    seen_sub = set()
    for section in sections:
        if section["level"] == 1 and section["page"] != 1 and section["title"]:
            label = section["title"].strip(" .…")
            key = label.lower()
            if key not in seen_sub and len(label) <= 80:
                seen_sub.add(key)
                subcategories.append({"name": label, "inferred": False})
    if not subcategories:
        for section in sections:
            if not section["title"] or section["page"] == 1:
                continue
            label = re.sub(r"\s*\.{2,}$", "", section["title"]).strip(" .")
            label = re.sub(r"\s*\(continuación\)\s*", "", label, flags=re.I).strip()
            key = label.lower()
            if not label or len(label) > 60 or key in seen_sub:
                continue
            seen_sub.add(key)
            subcategories.append({"name": label, "inferred": False, "source": "slide_title"})

    extracted_chars = len(re.sub(r"\s+", "", full_text))
    raw_chars = 0
    for page in doc:
        raw_chars += len(re.sub(r"\s+", "", page.get_text() or ""))
    coverage = 1.0 if raw_chars == 0 else extracted_chars / raw_chars

    payload = {
        "id": spec["id"],
        "slug": slug,
        "title": title,
        "description": description,
        "category": "Soldadura",
        "subcategory": [item["name"] for item in subcategories],
        "tags": tags,
        "language": "es",
        "author": author,
        "date": created_iso,
        "source_file": pdf_path.name,
        "page_count": doc.page_count,
        "featured_image": featured,
        "sections": sections,
        "images": images,
        "tables": tables,
        "links": dedup_links,
        "contacts": contacts,
        "seo": {
            "title": title,
            "meta_description": description,
            "slug": slug,
            "keywords": tags,
            "og_title": title,
            "og_description": description,
            "og_image": featured,
        },
        "metadata": {
            "course": "Soldadura",
            "class_label": class_line,
            "category_source": "extracted",
            "category_confidence": "high",
            "subcategories_detail": subcategories,
            "tags_inferred": True,
            "tags_note": "Etiquetas tomadas de términos que sí aparecen en el texto. No son una taxonomía impresa en el PDF.",
            "author_detail": author_detail,
            "date_detail": {
                "value": created_iso,
                "confidence": "high" if created_iso else "low",
                "source": "pdf_metadata" if created_iso else "unavailable",
                "reason": "Fecha de creación del archivo PDF (exportación desde PowerPoint), no una fecha declarada en el temario.",
            },
            "language_detail": {
                "value": "es",
                "confidence": "high",
                "source": "extracted",
                "reason": "El cuerpo de las diapositivas está en español.",
            },
            "description_detail": {
                "source": desc_source,
                "confidence": desc_conf,
            },
            "text_coverage": round(coverage, 3),
            "producer": "Microsoft PowerPoint",
        },
    }
    (doc_dir / "content.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    report["files"].append(
        {
            "id": spec["id"],
            "slug": slug,
            "source_file": pdf_path.name,
            "pages": doc.page_count,
            "pages_processed": len(sections),
            "images": len(images),
            "tables": len(tables),
            "links": len(dedup_links),
            "contacts": len(contacts),
            "text_coverage": round(coverage, 3),
            "visual_pages": visual_pages,
            "low_confidence_images": [item["id"] for item in low_conf],
        }
    )
    report["low_confidence"].extend([{**item, "file": pdf_path.name} for item in low_conf])
    doc.close()
    return payload


def build_indexes(documents: list[dict]) -> None:
    index = []
    for doc in documents:
        index.append(
            {
                "id": doc["id"],
                "slug": doc["slug"],
                "title": doc["title"],
                "description": doc["description"],
                "category": doc["category"],
                "subcategory": doc["subcategory"],
                "tags": doc["tags"],
                "language": doc["language"],
                "author": doc["author"],
                "date": doc["date"],
                "source_file": doc["source_file"],
                "page_count": doc["page_count"],
                "featured_image": f"documents/{doc['slug']}/{doc['featured_image']}" if doc["featured_image"] else None,
                "image_count": len(doc["images"]),
                "table_count": len(doc["tables"]),
                "link_count": len(doc["links"]),
            }
        )
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    categories = {
        "Soldadura": {
            "inferred": False,
            "source": "Título de portada de cada PDF",
            "documents": [doc["slug"] for doc in documents],
            "subcategories": [],
        }
    }
    sub_map: dict[str, set] = {}
    for doc in documents:
        for name in doc["subcategory"]:
            sub_map.setdefault(name, set()).add(doc["slug"])
    categories["Soldadura"]["subcategories"] = [
        {"name": name, "inferred": False, "documents": sorted(slugs)}
        for name, slugs in sorted(sub_map.items())
    ]
    (OUT / "categories.json").write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")

    tag_map: dict[str, list] = {}
    for doc in documents:
        for tag in doc["tags"]:
            tag_map.setdefault(tag, []).append(doc["slug"])
    tags_payload = [
        {"tag": tag, "inferred": True, "documents": slugs}
        for tag, slugs in sorted(tag_map.items())
    ]
    (OUT / "tags.json").write_text(json.dumps(tags_payload, ensure_ascii=False, indent=2), encoding="utf-8")


def build_inventory(documents: list[dict], pdfs: list[tuple[Path, dict]]) -> None:
    inventory = []
    for (path, spec), doc in zip(pdfs, documents):
        stat = path.stat()
        inventory.append(
            {
                "id": spec["id"],
                "original_name": path.name,
                "extension": path.suffix.lower(),
                "size_bytes": stat.st_size,
                "page_count": doc["page_count"],
                "title": doc["title"],
                "author": doc["metadata"]["author_detail"],
                "date": doc["metadata"]["date_detail"],
                "language": doc["metadata"]["language_detail"],
                "image_count": len(doc["images"]),
                "table_count": len(doc["tables"]),
                "section_count": len(doc["sections"]),
                "producer": "Microsoft PowerPoint para Microsoft 365",
                "class_label": doc["metadata"]["class_label"],
                "text_coverage": doc["metadata"]["text_coverage"],
            }
        )
    (OUT / "inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    alts = load_alts()
    pdfs = []
    for path in sorted(ROOT.glob("*.pdf")):
        pdfs.append((path, match_spec(path.name)))
    pdfs.sort(key=lambda item: item[1]["id"])
    report = {
        "files": [],
        "errors": [],
        "warnings": [],
        "low_confidence": [],
        "rejected_tables": [],
        "ocr_pages": [],
        "ocr_note": "Los PDF tienen texto seleccionable exportado desde PowerPoint. No se aplicó OCR de página completa. El texto dentro de figuras se revisa de forma visual.",
    }
    documents = []
    for path, spec in pdfs:
        print("extract", spec["slug"], flush=True)
        documents.append(extract_document(path, spec, alts, report))
    build_indexes(documents)
    build_inventory(documents, pdfs)
    report["totals"] = {
        "pdfs": len(documents),
        "pages": sum(doc["page_count"] for doc in documents),
        "images": sum(len(doc["images"]) for doc in documents),
        "tables": sum(len(doc["tables"]) for doc in documents),
        "categories": 1,
        "subcategories": len({name for doc in documents for name in doc["subcategory"]}),
        "tags": len({tag for doc in documents for tag in doc["tags"]}),
        "links": sum(len(doc["links"]) for doc in documents),
        "errors": len(report["errors"]),
        "warnings": len(report["warnings"]),
        "low_confidence": len(report["low_confidence"]),
    }
    missing = [spec["slug"] for spec in SPECS if spec["slug"] not in {doc["slug"] for doc in documents}]
    report["unprocessed"] = missing
    (OUT / "extraction-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["totals"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
