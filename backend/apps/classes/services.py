"""Logique métier des inscriptions — capacité vérifiée sous verrou pour éviter le surbooking."""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError

from apps.gyms.models import Membership

from .models import Booking, Session

logger = logging.getLogger(__name__)


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflit."
    default_code = "conflict"


def active_bookings_count(session: Session) -> int:
    return session.bookings.filter(status__in=Booking.ACTIVE_STATUSES).count()


@transaction.atomic
def book_session(user, session_id: int) -> Booking:
    # Verrou sur la ligne de la séance : deux inscriptions simultanées sont sérialisées.
    session = Session.objects.select_for_update().select_related("gym").get(pk=session_id)

    if session.status != Session.Status.PUBLISHED:
        raise ValidationError("Cette séance n'est pas ouverte aux inscriptions.")
    if session.starts_at <= timezone.now():
        raise ValidationError("Cette séance a déjà commencé.")
    if not Membership.objects.filter(user=user, gym=session.gym, status=Membership.Status.ACTIVE).exists():
        raise ValidationError("Votre adhésion n'est pas active.")

    existing = Booking.objects.filter(user=user, session=session).first()
    if existing and existing.status != Booking.Status.CANCELLED:
        raise Conflict("Vous êtes déjà inscrit à cette séance.")

    if active_bookings_count(session) >= session.capacity:
        raise Conflict("Séance complète.")

    if existing:
        existing.status = Booking.Status.BOOKED
        existing.save(update_fields=["status", "updated_at"])
        booking = existing
    else:
        booking = Booking.objects.create(user=user, session=session)

    transaction.on_commit(lambda: send_booking_confirmation(booking))
    return booking


def cancel_booking(user, session_id: int) -> Booking:
    session = Session.objects.select_related("gym").get(pk=session_id)
    booking = Booking.objects.filter(user=user, session=session).first()
    if not booking or booking.status != Booking.Status.BOOKED:
        raise ValidationError("Vous n'êtes pas inscrit à cette séance.")
    deadline = session.starts_at - timedelta(hours=session.gym.cancellation_deadline_hours)
    if timezone.now() > deadline:
        raise ValidationError(
            f"Désinscription impossible moins de {session.gym.cancellation_deadline_hours} h avant la séance."
        )
    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status", "updated_at"])
    return booking


@transaction.atomic
def record_attendance(session: Session, attendees: list[dict], close: bool = False) -> None:
    """attendees = [{"user": id, "present": bool}] ; un présent non inscrit est ajouté (venue spontanée)."""
    gym_user_ids = set(Membership.objects.filter(gym=session.gym).values_list("user_id", flat=True))
    for entry in attendees:
        user_id = entry["user"]
        if user_id not in gym_user_ids:
            raise ValidationError(f"L'utilisateur {user_id} n'est pas membre de la salle.")
        new_status = Booking.Status.PRESENT if entry["present"] else Booking.Status.ABSENT
        booking = Booking.objects.filter(user_id=user_id, session=session).first()
        if booking:
            booking.status = new_status
            booking.save(update_fields=["status", "updated_at"])
        elif entry["present"]:
            Booking.objects.create(user_id=user_id, session=session, status=Booking.Status.PRESENT)

    if close:
        session.bookings.filter(status=Booking.Status.BOOKED).update(status=Booking.Status.ABSENT)
        session.status = Session.Status.DONE
        session.save(update_fields=["status"])


def send_booking_confirmation(booking: Booking) -> None:
    session = booking.session
    local = timezone.localtime(session.starts_at)
    try:
        send_mail(
            subject=f"Inscription confirmée : {session.title}",
            message=(
                f"Bonjour {booking.user.first_name or ''},\n\n"
                f"Votre inscription à « {session.title} » le {local:%d/%m/%Y à %H:%M} est confirmée.\n"
                f"Désinscription possible jusqu'à {session.gym.cancellation_deadline_hours} h avant.\n\n"
                f"À bientôt chez {session.gym.name} !"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[booking.user.email],
            fail_silently=False,
        )
    except Exception:  # un email raté ne doit jamais casser une inscription
        logger.exception("Échec d'envoi de l'email de confirmation (booking %s)", booking.pk)
