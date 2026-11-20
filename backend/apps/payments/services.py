from datetime import date

from django.db.models import Max
from django.utils import timezone

from .models import Payment

UP_TO_DATE = "up_to_date"
LATE = "late"


def payment_status(user, gym, today: date | None = None) -> dict:
    """À jour = une période payée couvre aujourd'hui (ou au-delà). Sinon en retard."""
    today = today or timezone.localdate()
    paid_until = Payment.objects.filter(user=user, gym=gym).aggregate(m=Max("period_end"))["m"]
    return status_from_paid_until(paid_until, today)


def status_from_paid_until(paid_until, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    up = bool(paid_until and paid_until >= today)
    return {
        "status": UP_TO_DATE if up else LATE,
        "paid_until": paid_until.isoformat() if paid_until else None,
    }
