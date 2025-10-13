"""
URL configuration for mysite project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from myapp import views

urlpatterns = [
    path('', views.home_view, name='home'),
    path('admin/', admin.site.urls),
    path('events/', views.event_list, name='event_list'),
    path('events/<int:event_id>/', views.event_detail, name='event_detail'),
    path('consultations/', views.consultation_list, name='consultation_list'),
    path('consultations/<int:consultation_id>/', views.consultation_detail, name='consultation_detail'),
    path('consultations/<int:consultation_id>/events/', views.consultation_combined_view, name='consultation_combined'),
    path('import-tex/', views.import_tex_view, name='import_tex'),
    path("import-tex/submit/", views.submit_tex_form, name="submit_tex_form"),
    path('tex-library.json', views.tex_library_json, name='tex_library_json'),
    path('dental/', views.dental, name='dental'),
    path('audiogram/analysis/', views.audiogram_analysis, name='audiogram_analysis'),
    path("audio/", views.audio_poc, name="audio_poc"),
    path("army/grading/", views.army_grading, name="army_grading"),
    path("naval/grading/", views.naval_grading, name="naval_grading"),
    path("raf/grading/", views.raf_grading, name="raf_grading"),
]
