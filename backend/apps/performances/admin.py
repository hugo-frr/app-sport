from django.contrib import admin

from .models import PerformanceSet


@admin.register(PerformanceSet)
class PerformanceSetAdmin(admin.ModelAdmin):
    list_display = ["user", "exercise", "date", "set_number", "reps", "load_kg", "duration_seconds", "distance_m"]
    list_filter = ["exercise__gym", "exercise"]
    date_hierarchy = "date"
    search_fields = ["user__email", "user__last_name", "exercise__name"]
    autocomplete_fields = ["user", "exercise"]
    raw_id_fields = ["booking"]
