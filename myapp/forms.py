from django import forms
from django.conf import settings
from pathlib import Path


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
