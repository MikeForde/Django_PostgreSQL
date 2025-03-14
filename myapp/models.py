from django.db import models
import uuid

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
        managed = False  # Do not create or alter this table via migrations
        db_table = '"emispatient"."mr_event"'
        app_label = 'myapp'
