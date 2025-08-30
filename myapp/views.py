from django.shortcuts import render, get_object_or_404
from .models import MrEvent
from .models import MrConsultation
from .forms import TexUploadForm
from .tex_parser import parse_tex
from django.http import JsonResponse
from collections import OrderedDict

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


def import_tex_view(request):
    """Upload and render an EMIS PCS template."""
    form = TexUploadForm(request.POST or None, request.FILES or None)
    controls = []
    canvas = {"width": 0, "height": 0}
    all_read_codes = []     # across ReadCode + ReadList
    diary_read_codes = []   # from DiaryEntry only

    if request.method == "POST" and form.is_valid():
        tex_file = form.cleaned_data["tex_file"]
        content = tex_file.read().decode("latin-1")
        controls, canvas = parse_tex(content)

        # aggregate codes + build per-control hover strings
        for c in controls:
            per_ctrl = []

            # TEmisReadCode
            if getattr(c, "is_readcode", False) and c.rc_code:
                label = c.rc_term or c.rc_prompt or c.name
                all_read_codes.append({"code": c.rc_code, "label": label})
                per_ctrl.append(f"{c.rc_code} — {label}")

                # also include negation form if applicable
                if getattr(c, "rc_is_question", False) and getattr(c, "rc_has_negation", False):
                    neg_code = f"Negation-{c.rc_code}"
                    neg_label = f"Not - {label}"
                    all_read_codes.append({"code": neg_code, "label": neg_label})
                    per_ctrl.append(f"{neg_code} — {neg_label}")


            # TEmisReadList
            if getattr(c, "is_readlist", False) and c.options:
                for opt in c.options:
                    if opt.code:
                        all_read_codes.append({"code": opt.code, "label": opt.label})
                        per_ctrl.append(f"{opt.code} — {opt.label}")

            if getattr(c, "is_diary", False) and c.diary_readcode:
                label = c.diary_prompt or c.name
                diary_read_codes.append({"code": c.diary_readcode, "label": label})
                # NOTE: do NOT add diary codes to all_read_codes anymore
                per_ctrl.append(f"{c.diary_readcode} — {label}")

            # attach a data string for hover (can be empty)
            codes_text = "\n".join(per_ctrl)
            # safe: even if dataclass, adding attrs is fine at runtime
            setattr(c, "hover_codes", codes_text)

        # de-dup by code, keep first occurrence
        all_read_codes   = _uniq_by_code(all_read_codes)
        diary_read_codes = _uniq_by_code(diary_read_codes)

        if controls:
            canvas["width"] = max(c.x + c.width for c in controls) + 10
            canvas["height"] = max(c.y + c.height for c in controls) + 10

    context = {
        "form": form,
        "controls": controls,
        "canvas": canvas,
        "all_read_codes": all_read_codes,
        "diary_read_codes": diary_read_codes,
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

