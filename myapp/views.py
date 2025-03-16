from django.shortcuts import render, get_object_or_404
from .models import MrEvent
from .models import MrConsultation

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
