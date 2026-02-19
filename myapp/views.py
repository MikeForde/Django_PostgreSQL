from django.shortcuts import render, redirect, get_object_or_404
from .models import MrEvent
from .models import MrConsultation
from .models import TexSnapshot
from .forms import TexUploadForm
from .tex_parser import parse_tex
from django.http import JsonResponse
from collections import OrderedDict
from django.utils import timezone
from django.conf import settings

from django.urls import reverse
from urllib.parse import urlencode


# app/views.py
import re
import json
from django.http import HttpResponseBadRequest
from pathlib import Path
from django.views.decorators.http import require_GET

# For docx library (not fully implemented yet)
import zipfile
import xml.etree.ElementTree as ET
from .forms import DocxLibraryForm

import hashlib
import subprocess
from django.http import FileResponse, Http404


DOCX_W_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
DOCX_W_URI = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

@require_GET
def docx_file(request):
    """
    Streams a DOCX from DOCX_LIBRARY_DIR given a relpath ?p=...
    Used by client-side docx-preview renderer.
    """
    rel = (request.GET.get("p") or "").strip()
    if not rel:
        raise Http404()

    root = Path(getattr(settings, "DOCX_LIBRARY_DIR", "")).resolve()
    docx_path = (root / rel).resolve()

    # Prevent traversal
    try:
        docx_path.relative_to(root)
    except Exception:
        raise Http404()

    if not docx_path.is_file() or docx_path.suffix.lower() != ".docx":
        raise Http404()

    # Force download? No — we want browser fetch. Use correct MIME.
    return FileResponse(
        open(docx_path, "rb"),
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )



def _scan_docx_library_recursive(folder: str):
    """
    Recursively scans DOCX_LIBRARY_DIR and returns items with relative paths.

    Each item:
      - relpath: "sub/dir/file.docx" (POSIX style)
      - filename: basename
      - label: stem as human label
      - parts: ["sub","dir"] for tree
    """
    out = []
    if not folder:
        return out

    root = Path(folder)
    for p in sorted(root.rglob("*.docx")):
        if not p.is_file():
            continue

        rel = p.relative_to(root).as_posix()
        parts = list(Path(rel).parts[:-1])  # folders only
        out.append({
            "relpath": rel,
            "filename": p.name,
            "label": p.stem.replace("_", " "),
            "parts": parts,
        })

    # Sort alphabetically by label then relpath for stable list view
    out.sort(key=lambda d: (d["label"].lower(), d["relpath"].lower()))
    return out

@require_GET
def docx_library_json(request):
    folder = getattr(settings, "DOCX_LIBRARY_DIR", None)
    data = _scan_docx_library_recursive(folder)

    q = (request.GET.get("q") or "").strip().lower()
    if q:
        data = [
            d for d in data
            if q in d["label"].lower()
            or q in d["filename"].lower()
            or q in d["relpath"].lower()
        ]

    return JsonResponse({"items": data})


def _extract_docx_docvars(docx_path: Path):
    """
    Return list of {name, val} from word/settings.xml <w:docVars><w:docVar .../>
    """
    items = []
    try:
        with zipfile.ZipFile(docx_path, "r") as z:
            with z.open("word/settings.xml") as f:
                xml_bytes = f.read()
        root = ET.fromstring(xml_bytes)
        for dv in root.findall(".//w:docVars/w:docVar", DOCX_W_NS):
            name = dv.attrib.get(f"{{{DOCX_W_NS['w']}}}name") or ""
            val  = dv.attrib.get(f"{{{DOCX_W_NS['w']}}}val") or ""
            if name:
                items.append({"name": name, "val": val})
    except KeyError:
        # settings.xml missing
        pass
    except Exception:
        pass
    return items

def _parse_pipe_payload(raw: str):
    """
    Your common pattern: CODE|TERM|1|FLAGS...
    Returns dict with code/term/etc where possible.
    """
    parts = (raw or "").split("|")
    if len(parts) >= 2:
        return {
            "code": parts[0].strip(),
            "term": parts[1].strip(),
            "rest": "|".join(parts[2:]).strip() if len(parts) > 2 else "",
        }
    return {"code": "", "term": raw or "", "rest": ""}

def _docx_preview_blocks(docx_path: Path, max_blocks: int = 500):
    """
    Dependency-free preview that extracts paragraphs + basic tables from word/document.xml.

    Returns a list of blocks:
      {"type":"p", "text":"...", "style":"Heading1|Normal|...", "is_list":bool}
      {"type":"table", "rows":[["cell","cell"], ...]}
    """
    blocks = []

    def _p_style(p_el):
        # <w:pPr><w:pStyle w:val="Heading1"/>
        ppr = p_el.find("w:pPr", DOCX_W_NS)
        if ppr is None:
            return ""
        ps = ppr.find("w:pStyle", DOCX_W_NS)
        if ps is None:
            return ""
        return ps.attrib.get(f"{{{DOCX_W_NS['w']}}}val", "") or ""

    def _p_is_list(p_el):
        # light check: <w:numPr> exists
        ppr = p_el.find("w:pPr", DOCX_W_NS)
        if ppr is None:
            return False
        return ppr.find("w:numPr", DOCX_W_NS) is not None

    def _p_text(p_el):
        # Collect text runs w:t plus w:tab and w:br
        out = []
        # iterate in document order
        for node in p_el.iter():
            tag = node.tag
            if tag == f"{{{DOCX_W_URI}}}t" and node.text:
                out.append(node.text)
            elif tag == f"{{{DOCX_W_URI}}}tab":
                out.append("\t")
            elif tag == f"{{{DOCX_W_URI}}}br":
                out.append("\n")
        # Normalize whitespace lightly
        text = "".join(out)
        # Collapse excessive internal newlines but keep intent
        text = "\n".join([ln.rstrip() for ln in text.splitlines()]).strip()
        return text

    def _tbl_rows(tbl_el):
        rows = []
        for tr in tbl_el.findall(".//w:tr", DOCX_W_NS):
            row = []
            # direct cells
            for tc in tr.findall("./w:tc", DOCX_W_NS):
                # cell text = concat of paragraphs
                cell_lines = []
                for p in tc.findall(".//w:p", DOCX_W_NS):
                    t = _p_text(p)
                    if t:
                        cell_lines.append(t)
                row.append("\n".join(cell_lines).strip())
            if row:
                rows.append(row)
        return rows

    try:
        with zipfile.ZipFile(docx_path, "r") as z:
            with z.open("word/document.xml") as f:
                xml_bytes = f.read()
        root = ET.fromstring(xml_bytes)

        body = root.find(".//w:body", DOCX_W_NS)
        if body is None:
            return []

        for child in list(body):
            if len(blocks) >= max_blocks:
                break

            if child.tag == f"{{{DOCX_W_URI}}}p":
                txt = _p_text(child)
                style = _p_style(child)
                is_list = _p_is_list(child)

                if not txt:
                    continue

                # small UX: style/list prefixes
                if is_list and not txt.startswith(("•", "-", "*")):
                    txt = "• " + txt

                blocks.append({
                    "type": "p",
                    "text": txt,
                    "style": style,
                    "is_list": is_list,
                })

            elif child.tag == f"{{{DOCX_W_URI}}}tbl":
                rows = _tbl_rows(child)
                if rows:
                    blocks.append({
                        "type": "table",
                        "rows": rows,
                    })

    except Exception:
        return []

    return blocks

def _docx_preview_paragraphs(docx_path: Path, max_paras: int = 400):
    """
    V1 preview: extract paragraph text from word/document.xml (stdlib only).
    """
    paras = []
    try:
        with zipfile.ZipFile(docx_path, "r") as z:
            with z.open("word/document.xml") as f:
                xml_bytes = f.read()

        root = ET.fromstring(xml_bytes)

        # Each paragraph is w:p, text runs are w:t
        for p in root.findall(".//w:body/w:p", DOCX_W_NS):
            texts = []
            for t in p.findall(".//w:t", DOCX_W_NS):
                if t.text:
                    texts.append(t.text)
            line = "".join(texts).strip()
            if line:
                paras.append(line)
            if len(paras) >= max_paras:
                break

    except Exception:
        pass

    return paras

def import_docx_view(request):
    """
    List/Search/Tree-select a DOCX from DOCX_LIBRARY_DIR (recursive),
    render a simple preview (paragraph text) and show embedded codes/prompts
    extracted from word/settings.xml (w:docVars).

    Optional: if full_preview is ticked, render DOCX client-side using docx-preview.
    """
    form = DocxLibraryForm(request.POST or None)

    want_full = bool(request.POST.get("full_preview"))

    # Build library choices + index every request (so new files appear immediately)
    folder = getattr(settings, "DOCX_LIBRARY_DIR", None)
    choices = [("", "— choose a DOCX file —")]
    library_index = []
    if folder:
        library_index = _scan_docx_library_recursive(folder)
        for d in library_index:
            choices.append((d["relpath"], d["label"]))
    form.fields["library_choice"].choices = choices

    selected_name = ""
    preview_paras = []
    preview_blocks = []
    docvars = []
    read_codes = []
    full_docx_url = ""

    # Remember last mode like import_tex (optional but nice)
    lib_mode = request.POST.get("libmode") or request.session.get("docx_libmode", "list")

    if request.method == "POST" and form.is_valid():
        selected_name = (form.cleaned_data.get("library_choice") or "").strip()

        if selected_name:
            root = Path(getattr(settings, "DOCX_LIBRARY_DIR", "")).resolve()
            docx_path = (root / selected_name).resolve()

            # Prevent path traversal
            try:
                docx_path.relative_to(root)
            except Exception:
                return HttpResponseBadRequest("Invalid DOCX path.")

            if not (docx_path.is_file() and docx_path.suffix.lower() == ".docx"):
                return HttpResponseBadRequest("Invalid DOCX selection.")

            # Full preview uses client-side renderer; server just streams the docx
            if want_full:
                full_docx_url = reverse("docx_file") + "?" + urlencode({"p": selected_name})
            else:
                preview_blocks = _docx_preview_blocks(docx_path)

            # Metadata extraction (always)
            docvars = _extract_docx_docvars(docx_path)

            # Build the "codes" panel from relevant docVars
            tmp_codes = []
            for dv in docvars:
                n = dv.get("name", "")
                v = dv.get("val", "")

                if n.startswith("Read_Code_") or n.startswith("Diary_Entry_"):
                    parsed = _parse_pipe_payload(v)
                    tmp_codes.append({
                        "name": n,
                        "raw": v,
                        "code": parsed.get("code", ""),
                        "label": parsed.get("term", ""),
                        "rest": parsed.get("rest", ""),
                        "kind": "Read/Diary",
                    })
                elif n.startswith("Free_Text_Prompt_"):
                    tmp_codes.append({
                        "name": n,
                        "raw": v,
                        "code": "",
                        "label": v,
                        "rest": "",
                        "kind": "Prompt",
                    })

            # De-dup by code where present; keep prompts as-is
            seen_codes = set()
            read_codes = []
            for it in tmp_codes:
                c = (it.get("code") or "").strip()
                if c:
                    if c in seen_codes:
                        continue
                    seen_codes.add(c)
                read_codes.append(it)

        # persist mode selection
        request.session["docx_libmode"] = lib_mode
        request.session.modified = True

    context = {
        "form": form,
        "selected_docx_label": selected_name or "no docx file selected",
        "preview_paras": preview_paras,
        "preview_blocks": preview_blocks,
        "full_docx_url": full_docx_url,
        "read_codes": read_codes,
        "docvars_count": len(docvars),
        "docx_library_index_json": json.dumps(library_index),
        "libmode": lib_mode,
        "want_full": want_full,
    }
    return render(request, "import_docx.html", context)




TARGETPATH_RE = re.compile(r'^TARGETPATH\s*=\s*(.*)\s*$', re.IGNORECASE | re.MULTILINE)

def army_grading(request):
    if request.method == "POST":
        # TODO: persist request.POST as needed
        # return redirect(...) or show a success message
        pass
    return render(request, "army_grading.html")

def naval_grading(request):
    if request.method == "POST":
        # TODO: persist request.POST as needed
        # return redirect(...) or show a success message
        pass
    return render(request, "naval_grading.html")

def raf_grading(request):
    if request.method == "POST":
        # TODO: persist request.POST as needed
        # return redirect(...) or show a success message
        pass
    return render(request, "raf_grading.html")

def _read_targetpath_from_content(text):
    """
    Find TARGETPATH=... inside the TEX header. Returns a cleaned path string or ''.
    """
    if not text:
        return ''
    m = TARGETPATH_RE.search(text)
    if not m:
        return ''
    # normalize: strip surrounding slashes/backslashes, collapse repeated slashes
    raw = m.group(1).strip()
    raw = raw.strip('\\/ ')
    # Convert Windows-style backslashes to forward slashes for consistency
    return re.sub(r'[\\/]+', '/', raw)

def _scan_tex_library(folder: str):
    """
    Returns a list of dicts describing each .tex in the library:
      - filename: actual filename (for posting back)
      - label: human label (underscores -> spaces)
      - targetpath: normalized TARGETPATH ('' if none)
      - parts: list of path segments (for building the tree on the client)
    """
    out = []
    if not folder:
        return out
    root = Path(folder)
    for p in sorted(root.glob('*.tex')):
        try:
            # Only read the first ~16KB — headers are tiny
            snippet = p.read_text(encoding='latin-1', errors='ignore')[:16384]
        except Exception:
            snippet = ''
        target = _read_targetpath_from_content(snippet)
        parts = [seg for seg in target.split('/') if seg] if target else []
        out.append({
            'filename': p.name,
            'label': p.stem.replace('_', ' '),
            'targetpath': target,
            'parts': parts,
        })
    return out

@require_GET
def tex_library_json(request):
    folder = getattr(settings, "TEX_LIBRARY_DIR", None)
    data = _scan_tex_library(folder)
    q = (request.GET.get('q') or '').strip().lower()
    if q:
        data = [d for d in data
                if q in d['label'].lower()
                or q in d['filename'].lower()
                or q in d['targetpath'].lower()]
    return JsonResponse({'items': data})

def audio_poc(request):
    return render(request, "audio_poc.html")

def audiogram_analysis(request):
    if request.method != 'POST':
        return HttpResponseBadRequest('POST only')
    payload = request.POST.get('payload', '')
    try:
        data = json.loads(payload)
    except Exception:
        return HttpResponseBadRequest('Invalid payload')

    # Pass raw arrays to the template; calculations & drawing done client-side
    return render(request, 'audiogram_analysis.html', {
        'payload_json': json.dumps(data),  # safe JSON for the page
    })


def home_view(request):
    """
    Displays the landing page.
    """
    return render(request, 'home.html')

def dental(request):
    return render(request, 'dental.html')

def event_list(request):
    """
    Displays the first 100 MrEvent records in a list view.
    """
    events = MrEvent.objects.all()[:100]
    return render(request, 'event_list.html', {'events': events})

def event_detail(request, event_id):
    """
    Displays the details of a single MrEvent record, based on the `event_id`.
    """
    event = get_object_or_404(MrEvent, id=event_id)
    return render(request, 'event_detail.html', {'event': event})

def consultation_list(request):
    """
    Displays the first 100 MrConsultation records in a list view.
    """
    consultations = MrConsultation.objects.all()[:100]
    return render(request, 'consultation_list.html', {'consultations': consultations})

def consultation_detail(request, consultation_id):
    """
    Displays the details of a single MrConsultation record, based on `consultation_id`.
    """
    consultation = get_object_or_404(MrConsultation, id=consultation_id)
    return render(request, 'consultation_detail.html', {'consultation': consultation})

def consultation_combined_view(request, consultation_id):
    """
    Displays consultation details along with related events.
    Replaces <c> in `descriptive_text` with `display_term`.
    """
    consultation = get_object_or_404(MrConsultation, id=consultation_id)
    events = MrEvent.get_events_by_consultation(consultation_id)
    
    return render(request, 'consultation_combined.html', {
        'consultation': consultation,
        'events': events
    })

def _ensure_session_key(request):
    """Guarantee we have a session_key (needed to key the snapshot)."""
    if not request.session.session_key:
        request.session.save()
    return request.session.session_key


def _build_context(controls, canvas):
    """Your existing aggregation logic, factored to reuse for POST/GET restore."""
    all_read_codes = []
    diary_read_codes = []

    # aggregate codes + build per-control hover strings
    for c in controls:
        per_ctrl = []

        # TEmisReadCode
        if getattr(c, "is_readcode", False) and getattr(c, "rc_code", None):
            label = c.rc_term or c.rc_prompt or c.name
            all_read_codes.append({"code": c.rc_code, "label": label})
            per_ctrl.append(f"{c.rc_code} — {label}")

            if getattr(c, "rc_is_question", False) and getattr(c, "rc_has_negation", False):
                neg_code = f"NEGATION-{c.rc_code}"
                neg_label = f"Not - {label}"
                all_read_codes.append({"code": neg_code, "label": neg_label})
                per_ctrl.append(f"{neg_code} — {neg_label}")

        # TEmisReadList
        if getattr(c, "is_readlist", False) and getattr(c, "options", None):
            for opt in c.options:
                if opt.code:
                    all_read_codes.append({"code": opt.code, "label": opt.label})
                    per_ctrl.append(f"{opt.code} — {opt.label}")

        # Diary (keep separate)
        if getattr(c, "is_diary", False) and getattr(c, "diary_readcode", None):
            label = c.diary_prompt or c.name
            diary_read_codes.append({"code": c.diary_readcode, "label": label})
            per_ctrl.append(f"{c.diary_readcode} — {label}")

        # attach for hover
        hover_parts = per_ctrl[:]
        if c.props.get("TextAuto"):   # NEW
            hover_parts.append(
                f"Auto-Entered Text: {c.props['TextAuto']}"
            )
        setattr(c, "hover_codes", "\n".join(hover_parts))

    # de-dup
    all_read_codes   = _uniq_by_code(all_read_codes)
    diary_read_codes = _uniq_by_code(diary_read_codes)

    # canvas size (fallback)
    if controls:
        canvas["width"]  = max((c.x + c.width)  for c in controls) + 10
        canvas["height"] = max((c.y + c.height) for c in controls) + 10

    return all_read_codes, diary_read_codes, canvas


def import_tex_view(request):
    """Upload or load a library TEX; persist last render in a per-session snapshot."""
    form = TexUploadForm(request.POST or None, request.FILES or None)

    # Rebuild library choices on each request so newly added files appear.
    library_index = []
    if hasattr(form.fields["library_choice"], "choices"):
        folder = getattr(settings, "TEX_LIBRARY_DIR", None)
        choices = [("", "— choose a TEX file —")]
        if folder:
            library_index = _scan_tex_library(folder)
            for d in library_index:
                choices.append((d['filename'], d['label']))
        form.fields["library_choice"].choices = choices

    controls = []
    canvas = {"width": 0, "height": 0}

    lib_mode = request.POST.get("libmode") or request.session.get("libmode", "list")

    # Try to restore prior snapshot
    snap = None
    last_id = request.session.get("last_tex_id")
    if last_id:
        snap = TexSnapshot.objects.filter(id=last_id).first()

    content = None
    src_name = None

    if request.method == "POST" and form.is_valid():
        # Prefer library selection if provided
        lib_choice = form.cleaned_data.get("library_choice") or ""
        if lib_choice:
            # sanitize to basename; prevent traversal
            lib_file = Path(getattr(settings, "TEX_LIBRARY_DIR", "")) / Path(lib_choice).name
            if lib_file.is_file() and lib_file.suffix.lower() == ".tex":
                content = lib_file.read_text(encoding="latin-1", errors="ignore")
                src_name = lib_file.name
            else:
                return HttpResponseBadRequest("Invalid library selection.")
        elif form.cleaned_data.get("tex_file"):
            # Regular upload
            tex_file = form.cleaned_data["tex_file"]
            content = tex_file.read().decode("latin-1", errors="ignore")
            src_name = getattr(tex_file, "name", "upload.tex")

        if content is not None:
            session_key = _ensure_session_key(request)
            snap, _ = TexSnapshot.objects.update_or_create(
                session_key=session_key,
                defaults={
                    "qualified_name": src_name or "",
                    "blob": content,
                }
            )
            request.session["last_tex_id"] = snap.id
            request.session.modified = True
            controls, canvas = parse_tex(content)
        elif snap:
            # valid POST but nothing provided; fall back to last snapshot if any
            controls, canvas = parse_tex(snap.blob)

        request.session["libmode"] = lib_mode
        request.session.modified = True
    elif snap:
        # GET: restore most recent render
        controls, canvas = parse_tex(snap.blob)

    # Aggregate codes + build context (your helper)
    all_read_codes, diary_read_codes, canvas = _build_context(controls, canvas)

    context = {
        "form": form,
        "controls": controls,
        "canvas": canvas,
        "all_read_codes": all_read_codes,
        "diary_read_codes": diary_read_codes,
        # demo arrays still available
        "ac_1_r": [10, 15, 5, 10, 25, 40, 55],
        "ac_1_l": [5, 5, 15, 10, 20, 25, 15],
        "ac_2_r": [5, 15, 5, -5, 5, 0, -5],
        "ac_2_l": [5, 0, 15, 5, 10, 5, 15],
        "snowfusion_url": settings.SNOWFUSION_BASE_URL,
        "tex_library_index_json": json.dumps(library_index),
        "libmode": lib_mode,
    }
    return render(request, "import_tex.html", context)


def submit_tex_form(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)
    posted = {}
    for key, values in request.POST.lists():
        if key == "csrfmiddlewaretoken":
            continue
        posted[key] = values if len(values) > 1 else values[0]
    return render(request, "import_tex_result.html", {"data": posted})


# utils for de-dup


def _uniq_by_code(items):
    """items: list of dicts with 'code' and 'label' -> keep first by code"""
    seen = set()
    out = []
    for it in items:
        code = it.get("code")
        if not code or code in seen:
            continue
        seen.add(code)
        out.append(it)
    return out

