from django import forms


class TexUploadForm(forms.Form):
    tex_file = forms.FileField(label="TEX file")
