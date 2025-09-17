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


# app/views.py
import json
from django.http import HttpResponseBadRequest
from pathlib import Path

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
                neg_code = f"Negation-{c.rc_code}"
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
        setattr(c, "hover_codes", "\n".join(per_ctrl))

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
    if hasattr(form.fields["library_choice"], "choices"):
        folder = getattr(settings, "TEX_LIBRARY_DIR", None)
        choices = [("", "— choose a sample —")]
        if folder:
            files = [p for p in Path(folder).glob("*.tex") if p.is_file()]
            for p in sorted(files):
                # base filename without extension
                base = p.stem
                # human label: replace "_" with " ", keep nice casing
                label = base.replace("_", " ")
                choices.append((p.name, label))
        form.fields["library_choice"].choices = choices

    controls = []
    canvas = {"width": 0, "height": 0}

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

