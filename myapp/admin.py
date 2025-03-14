from django.contrib import admin
from .models import MrEvent

@admin.register(MrEvent)
class MrEventAdmin(admin.ModelAdmin):
    # Make it read-only so Django doesn't try to CREATE/UPDATE
    readonly_fields = [
        'id', 'patient_id', 'assigned_date', 'date_part', 'event_author_id',
        'consultation_id', 'descriptive_text', 'display_term', 'episodicity',
        'event_type_id', 'code', 'term_id', 'numeric_operator', 'numeric_value',
        'numeric_units', 'numeric_minimum', 'numeric_maximum', 'min_range_operator',
        'max_range_operator', 'abnormal', 'external_consultant', 'gms', 'data_source',
        'policy_id', 'templateinstance_id', 'template_id', 'template_component_name',
        'deleted', 'reason_for_deletion', 'record_date', 'guid', 'src_xml', 'batch_id',
        'assigned_date_time_zone', 'event_original_author', 'updated', 'inserted',
    ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

