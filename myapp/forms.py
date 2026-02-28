from django import forms
from django.conf import settings
from pathlib import Path
from .models import ReadSnomedIntMap, ReadSnomedUkMap


def _choices_from_library():
    folder = getattr(settings, "TEX_LIBRARY_DIR", None)
    if not folder:
        return []
    # list *.tex in the folder only (no recursion)
    files = [p for p in Path(folder).glob("*.tex") if p.is_file()]
    # (value, label) — value will be filename (not path)
    return [ (p.name, p.name) for p in sorted(files) ]

class TexUploadForm(forms.Form):
    tex_file = forms.FileField(required=False, label="Upload TEX")
    library_choice = forms.ChoiceField(
        required=False,
        label="Or pick from library",
        choices=[("", "— choose a sample —")] + _choices_from_library(),
    )

class DocxLibraryForm(forms.Form):
    library_choice = forms.ChoiceField(
        choices=[("", "— choose a DOCX file —")],
        required=False
    )

class ReadSnomedIntMapForm(forms.ModelForm):
    class Meta:
        model = ReadSnomedIntMap
        fields = ["read_code", "concept_id", "term", "description_id"]
        widgets = {
            "read_code": forms.TextInput(attrs={"maxlength": 10}),
            "concept_id": forms.TextInput(),
            "description_id": forms.TextInput(),
            "term": forms.Textarea(attrs={"rows": 4}),
        }

class ReadSnomedUkMapForm(forms.ModelForm):
    class Meta:
        model = ReadSnomedUkMap
        fields = ["read_code", "concept_id", "term", "description_id"]
        widgets = {
            "read_code": forms.TextInput(attrs={"maxlength": 10}),
            "concept_id": forms.TextInput(),
            "description_id": forms.TextInput(),
            "term": forms.Textarea(attrs={"rows": 4}),
        }
