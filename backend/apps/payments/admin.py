from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["user", "amount_euros", "paid_on", "method", "period_start", "period_end", "gym"]
    list_filter = ["gym", "method"]
    date_hierarchy = "paid_on"
    search_fields = ["user__email", "user__last_name"]
    autocomplete_fields = ["user"]

    @admin.display(description="montant")
    def amount_euros(self, obj):
        return f"{obj.amount_cents / 100:.2f} €"

    def save_model(self, request, obj, form, change):
        if not obj.recorded_by_id:
            obj.recorded_by = request.user
        super().save_model(request, obj, form, change)
