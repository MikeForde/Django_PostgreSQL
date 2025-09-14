from django.db import models, connection
from django.utils.safestring import mark_safe
import uuid

class TexSnapshot(models.Model):
    session_key = models.CharField(max_length=64, db_index=True)
    qualified_name = models.CharField(max_length=200, blank=True)  # e.g. 'Audiometry_Widget'
    blob = models.TextField()  # the raw TEX or your normalized JSON
    updated_at = models.DateTimeField(auto_now=True)

class MrEvent(models.Model):
    id = models.IntegerField(primary_key=True)
    patient_id = models.IntegerField()
    assigned_date = models.DateTimeField()
    date_part = models.IntegerField()
    event_author_id = models.IntegerField(null=True, blank=True)
    consultation_id = models.IntegerField(null=True, blank=True)
    descriptive_text = models.TextField(null=True, blank=True)  # 5120 chars; TextField is suitable
    display_term = models.CharField(max_length=200, null=True, blank=True)
    episodicity = models.SmallIntegerField(null=True, blank=True)  # TINYINT in SQL Server, typically a small int in PostgreSQL
    event_type_id = models.IntegerField()
    code = models.CharField(max_length=50, null=True, blank=True)
    term_id = models.CharField(max_length=50, null=True, blank=True)
    numeric_operator = models.CharField(max_length=10, null=True, blank=True)
    numeric_value = models.FloatField(null=True, blank=True)
    numeric_units = models.CharField(max_length=50, null=True, blank=True)
    numeric_minimum = models.FloatField(null=True, blank=True)
    numeric_maximum = models.FloatField(null=True, blank=True)
    min_range_operator = models.CharField(max_length=10, null=True, blank=True)
    max_range_operator = models.CharField(max_length=10, null=True, blank=True)
    abnormal = models.BooleanField(null=True, blank=True)  # bit in SQL Server
    external_consultant = models.CharField(max_length=50, null=True, blank=True)
    gms = models.BooleanField(null=True, blank=True)       # bit in SQL Server
    data_source = models.SmallIntegerField()               # tinyint in SQL Server
    policy_id = models.IntegerField(null=True, blank=True)
    templateinstance_id = models.IntegerField(null=True, blank=True)
    template_id = models.IntegerField(null=True, blank=True)
    template_component_name = models.CharField(max_length=100, null=True, blank=True)
    deleted = models.BooleanField()  # bit in SQL Server; if you know it's nullable, add null=True/blank=True
    reason_for_deletion = models.CharField(max_length=200, null=True, blank=True)
    record_date = models.DateTimeField()
    guid = models.UUIDField(default=uuid.uuid4)  # or null=False if DB is always set
    src_xml = models.IntegerField(null=True, blank=True)
    batch_id = models.IntegerField(null=True, blank=True)
    assigned_date_time_zone = models.IntegerField(null=True, blank=True)
    event_original_author = models.IntegerField(null=True, blank=True)
    updated = models.DateTimeField(null=True, blank=True)
    inserted = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False # Do not create or alter this table via migrations
        db_table = '"emispatient"."mr_event"'
        app_label = 'myapp'

    @staticmethod
    def get_events_by_consultation(consultation_id):
        """
        Fetches all events linked to a given consultation, using a raw SQL join.
        Replaces `<c>` in `descriptive_text` with `display_term` and filters out unwanted entries.
        """
        query = """
            SELECT e.id, e.descriptive_text, e.display_term
            FROM "emispatient"."mr_event" e
            JOIN "emispatient"."mr_consultation_content" c
                ON e.id = c.item_id
            WHERE e.consultation_id = %s
            ORDER BY c.heading_id, c.display_order
        """
        with connection.cursor() as cursor:
            cursor.execute(query, [consultation_id])
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Replace `<c>` with `display_term` and filter out unwanted rows
        filtered_results = []
        for result in results:
            descriptive_text = result["descriptive_text"] or ""
            display_term = result["display_term"] or ""
            formatted_text = descriptive_text.replace("<c>", display_term)
            
            # Remove entries with "Fit for Full Duties within current MES"
            if formatted_text.strip().lower() != "fit for full duties within current mes":
                result["formatted_text"] = mark_safe(formatted_text)  # Mark safe to allow rendering
                filtered_results.append(result)

        return filtered_results


class MrConsultation(models.Model):
    id = models.IntegerField(primary_key=True)
    assigned_date = models.DateTimeField()
    date_part = models.SmallIntegerField()
    user_id = models.IntegerField(null=True, blank=True)
    patient_id = models.IntegerField()
    location_id = models.IntegerField(null=True, blank=True)
    location_type_id = models.IntegerField(null=True, blank=True)
    accompanying_hcp_id = models.IntegerField(null=True, blank=True)
    external_consultant = models.CharField(max_length=50, null=True, blank=True)
    consultation_type = models.SmallIntegerField(null=True, blank=True)
    duration = models.SmallIntegerField(null=True, blank=True)
    travel_time = models.SmallIntegerField(null=True, blank=True)
    appointment_slot_id = models.IntegerField(null=True, blank=True)
    data_source_id = models.SmallIntegerField()
    policy_id = models.IntegerField(null=True, blank=True)
    deleted = models.BooleanField()

    class Meta:
        managed = False  # We are using an existing table
        db_table = '"emispatient"."mr_consultation"'
