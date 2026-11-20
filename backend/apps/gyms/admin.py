from django.contrib import admin

from .models import Gym, Membership


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0
    autocomplete_fields = ["user"]


@admin.register(Gym)
class GymAdmin(admin.ModelAdmin):
    list_display = ["name", "address", "invite_code", "cancellation_deadline_hours"]
    search_fields = ["name"]
    inlines = [MembershipInline]


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "gym", "status", "joined_at"]
    list_filter = ["gym", "status"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
