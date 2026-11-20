from django.contrib import admin

from .models import Booking, Session, TemplateItem, WorkoutTemplate


class TemplateItemInline(admin.TabularInline):
    model = TemplateItem
    extra = 1
    autocomplete_fields = ["exercise"]


@admin.register(WorkoutTemplate)
class WorkoutTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "gym"]
    list_filter = ["gym"]
    search_fields = ["name"]
    inlines = [TemplateItemInline]


class BookingInline(admin.TabularInline):
    model = Booking
    extra = 0
    autocomplete_fields = ["user"]


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ["title", "starts_at", "kind", "capacity", "status", "coach", "gym"]
    list_filter = ["gym", "status", "kind"]
    date_hierarchy = "starts_at"
    search_fields = ["title"]
    inlines = [BookingInline]
    actions = ["publish"]

    @admin.action(description="Publier les séances sélectionnées")
    def publish(self, request, queryset):
        queryset.update(status=Session.Status.PUBLISHED)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["user", "session", "status", "booked_at"]
    list_filter = ["status", "session__gym"]
    search_fields = ["user__email", "user__last_name", "session__title"]
