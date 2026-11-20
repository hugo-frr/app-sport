from django.conf import settings
from django.db import models


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = "cash", "Espèces"
        TRANSFER = "transfer", "Virement"
        CARD = "card", "CB sur place"
        CHEQUE = "cheque", "Chèque"
        OTHER = "other", "Autre"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    gym = models.ForeignKey("gyms.Gym", on_delete=models.CASCADE, related_name="payments")
    amount_cents = models.PositiveIntegerField("montant (centimes)")
    paid_on = models.DateField("date du paiement")
    method = models.CharField("moyen", max_length=10, choices=Method.choices, default=Method.CASH)
    period_start = models.DateField("début de période")
    period_end = models.DateField("fin de période")
    note = models.CharField(max_length=255, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "paiement"
        ordering = ["-paid_on", "-id"]

    def __str__(self):
        return f"{self.user} {self.amount_cents / 100:.2f} € ({self.period_start} → {self.period_end})"
