# docx_parser.py
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import re


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}


@dataclass
class LegacyField:
    code: str
    label: Optional[str]
    kind: str = "legacy_form_field"


def _gettext_from_runs(run_elems: List[ET.Element]) -> str:
    parts: List[str] = []
    for r in run_elems:
        for t in r.findall(".//w:t", NS):
            if t.text:
                parts.append(t.text)
    return "".join(parts).strip()


def _best_label_near_run(paragraph_runs: List[ET.Element], run_idx: int) -> Optional[str]:
    left_window = paragraph_runs[max(0, run_idx - 6): run_idx]
    right_window = paragraph_runs[run_idx + 1: min(len(paragraph_runs), run_idx + 7)]

    left_text = _gettext_from_runs(left_window)
    if left_text:
        return left_text

    right_text = _gettext_from_runs(right_window)
    if right_text:
        return right_text

    return None


def parse_document_xml(docx_path: str) -> Dict[str, Any]:
    """
    Parse word/document.xml (authoritative) and *lightly* enrich labels using word/settings.xml docVars:
      - Read_Code_* and Diary_Entry_*: append the docVar "title" (2nd pipe chunk) to the label.
      - Free_Text_Prompt_*: use the docVar raw value as the prompt text in the label.
    """
    with ZipFile(docx_path, "r") as z:
        xml_bytes = z.read("word/document.xml")
        settings_bytes = None
        try:
            settings_bytes = z.read("word/settings.xml")
        except KeyError:
            settings_bytes = None

    root = ET.fromstring(xml_bytes)

    # Parse settings docVars to: name -> raw string
    settings_docvars: Dict[str, str] = {}
    if settings_bytes:
        try:
            sroot = ET.fromstring(settings_bytes)
            for dv in sroot.findall(".//w:docVars/w:docVar", NS):
                name = dv.get(f"{{{W_NS}}}name")
                val = dv.get(f"{{{W_NS}}}val")
                if name and val is not None:
                    settings_docvars[name] = val
        except Exception:
            # keep best-effort; no hard fail
            settings_docvars = settings_docvars

    fields: List[LegacyField] = []
    seen: set[str] = set()

    debug_log: List[str] = []
    paragraph_count = 0
    run_count = 0
    legacy_formtext_hits = 0
    legacy_skipped_non_textinput = 0
    legacy_skipped_missing_result = 0
    enriched_read_diary = 0
    enriched_free_text = 0

    def normalize_space(s: str) -> str:
        return " ".join((s or "").replace("\u00a0", " ").split()).strip()

    # local helper (NO new top-level function names)
    def add_field(code: str, label: Optional[str], kind: str, where: str) -> None:
        nonlocal enriched_read_diary, enriched_free_text

        c = (code or "").strip()
        lbl = (label or "").strip()
        
        if not c:
            return

        # 🔥 HARD FILTER: ignore fields with no meaningful label
        if not lbl or lbl.lower() == "none":
            debug_log.append(f"[DROP] code={c} no usable label at {where}")
            return
    
        if c in seen:
            debug_log.append(f"[SKIP] duplicate code={c} at {where}")
            return

        lbl = (label or "").strip() or None

        # ---------------------------
        # LIGHT ENRICHMENT FROM SETTINGS
        # ---------------------------
        raw = settings_docvars.get(c)
        if raw is not None:
            raw_norm = normalize_space(raw)

            # Free text prompt: use raw prompt as label suffix
            if c.startswith("Free_Text_Prompt_"):
                # Example: "Free Text Prompt - Enter the President's name here"
                base = lbl or "Free Text Prompt"
                lbl = f"{base} - {raw_norm}" if raw_norm else base
                enriched_free_text += 1
                debug_log.append(f"[ENRICH] FreeText code={c} raw={raw_norm!r} at {where}")

            # Read/Diary codes: append the title (2nd chunk after split by |)
            elif c.startswith("Read_Code_") or c.startswith("Diary_Entry_"):
                parts = [p.strip() for p in raw.split("|")]
                title = normalize_space(parts[1]) if len(parts) >= 2 else ""
                if title:
                    # Example: "Read Code Fields - RAFPUPU1 - PULHHEEMS Profile"
                    if lbl:
                        lbl = f"{lbl} - {title}"
                    else:
                        lbl = title
                    enriched_read_diary += 1
                    debug_log.append(f"[ENRICH] Read/Diary code={c} title={title!r} at {where}")

        seen.add(c)
        fields.append(LegacyField(code=c, label=lbl, kind=kind))
        debug_log.append(f"[ADD]  {c}  kind={kind}  label={lbl!r}  at {where}")

    # We are intentionally not outputting mergefields/sdt/etc right now (avoid clutter).

    for p_idx, p in enumerate(root.findall(".//w:p", NS)):
        paragraph_count += 1
        runs = p.findall("./w:r", NS)
        run_count += len(runs)

        for i, r in enumerate(runs):
            # legacy form field name
            name_el = r.find(".//w:fldChar/w:ffData/w:name", NS)
            if name_el is None:
                continue

            code = name_el.get(f"{{{W_NS}}}val")
            if not code:
                continue

            ffdata = r.find(".//w:fldChar/w:ffData", NS)

            # Only keep text-input legacy fields (FORMTEXT) — skip checkboxes etc
            has_text_input = ffdata is not None and ffdata.find("./w:textInput", NS) is not None
            if not has_text_input:
                legacy_skipped_non_textinput += 1
                debug_log.append(f"[SKIP] legacy non-textInput code={code!r} at p[{p_idx}]/r[{i}]")
                continue

            # Find 'separate' then collect result text until 'end'
            sep_idx: Optional[int] = None
            end_idx: Optional[int] = None

            j = i
            while j < len(runs):
                fc = runs[j].find("./w:fldChar", NS)
                if fc is not None:
                    t = fc.get(f"{{{W_NS}}}fldCharType")
                    if t == "separate" and sep_idx is None:
                        sep_idx = j
                    elif t == "end" and sep_idx is not None:
                        end_idx = j
                        break
                j += 1

            if sep_idx is None or end_idx is None or end_idx <= sep_idx:
                legacy_skipped_missing_result += 1
                debug_log.append(f"[SKIP] missing separate/end code={code!r} at p[{p_idx}]/r[{i}]")
                continue

            result_text = _gettext_from_runs(runs[sep_idx + 1: end_idx]) or None

            legacy_formtext_hits += 1
            add_field(
                code=code,
                label=result_text,
                kind="legacy_formtext",
                where=f"p[{p_idx}]/r[{i}] (sep=r[{sep_idx}] end=r[{end_idx}])",
            )

    by_code: Dict[str, Dict[str, Any]] = {f.code: asdict(f) for f in fields}
    codes: List[str] = [f.code for f in fields]

    debug_log.append("\n--- SUMMARY ---")
    debug_log.append(
        f"paragraphs={paragraph_count} runs={run_count} "
        f"legacy_formtext_hits={legacy_formtext_hits} "
        f"skipped_non_textinput={legacy_skipped_non_textinput} "
        f"skipped_missing_result={legacy_skipped_missing_result} "
        f"enriched_read_diary={enriched_read_diary} "
        f"enriched_free_text={enriched_free_text} "
        f"unique_codes={len(codes)} settings_docvars={len(settings_docvars)}"
    )

    return {
        "source": "word/document.xml (+light settings.xml enrichment)",
        "legacy_fields": [asdict(f) for f in fields],
        "codes": codes,
        "by_code": by_code,
        "debug_log": debug_log,
    }
