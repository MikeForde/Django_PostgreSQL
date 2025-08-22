from django.shortcuts import render, get_object_or_404
from .models import MrEvent
from .models import MrConsultation
from .forms import TexUploadForm
from .tex_parser import parse_tex
from django.http import JsonResponse

def home_view(request):
    """
    Displays the landing page.
    """
    return render(request, 'home.html')

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

    if request.method == "POST" and form.is_valid():
        tex_file = form.cleaned_data["tex_file"]
        content = tex_file.read().decode("latin-1")

        # NEW: parser now returns (controls, canvas)
        controls, parsed_canvas = parse_tex(content)

        # prefer canvas from parser; safe fallback to computed bounds
        if parsed_canvas and parsed_canvas.get("width") and parsed_canvas.get("height"):
            canvas = parsed_canvas
        elif controls:
            canvas = {
                "width":  max(c.x + c.width for c in controls) + 10,
                "height": max(c.y + c.height for c in controls) + 10,
            }

    context = {"form": form, "controls": controls, "canvas": canvas}
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
