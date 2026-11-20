from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Max, OuterRef, Q, Subquery
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.classes.models import Booking, Session
from apps.core.access import (
    IsCoachOfGym,
    clear_gym_cache,
    get_current_gym,
    get_gym_member_or_404,
    require_gym,
)
from apps.payments.models import Payment
from apps.payments.services import status_from_paid_until
from apps.performances.models import PerformanceSet

from .models import Membership
from .serializers import (
    GymSerializer,
    JoinGymSerializer,
    MemberListSerializer,
    MembershipUpdateSerializer,
)


class JoinGymView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "join"

    @extend_schema(request=JoinGymSerializer, responses={200: GymSerializer})
    def post(self, request):
        s = JoinGymSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        gym = s.validated_data["code"]
        current = get_current_gym(request.user)
        if current and current != gym:
            raise ValidationError("Vous êtes déjà membre d'une autre salle (multi-salles prévu en v2).")
        membership, created = Membership.objects.get_or_create(user=request.user, gym=gym)
        clear_gym_cache(request.user)
        if not created and membership.status == Membership.Status.SUSPENDED:
            raise ValidationError("Votre adhésion est suspendue, contactez votre coach.")
        data = GymSerializer(gym).data
        if not request.user.is_coach:
            data.pop("invite_code")
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MyGymView(generics.RetrieveUpdateAPIView):
    serializer_class = GymSerializer
    permission_classes = [IsCoachOfGym]

    def get_object(self):
        return require_gym(self.request.user)


@extend_schema(request=None, responses={200: GymSerializer})
@api_view(["POST"])
@permission_classes([IsCoachOfGym])
def regenerate_invite_code(request):
    gym = require_gym(request.user)
    gym.regenerate_invite_code()
    return Response(GymSerializer(gym).data)


def members_queryset(gym, today=None):
    """Adhérents de la salle annotés : dernière venue, payé jusqu'au."""
    memberships = Membership.objects.filter(gym=gym, user=OuterRef("pk"))
    return (
        User.objects.filter(memberships__gym=gym, role=User.Role.MEMBER)
        .annotate(
            membership_status=Subquery(memberships.values("status")[:1]),
            joined_at=Subquery(memberships.values("joined_at")[:1]),
            last_visit=Max(
                "bookings__session__starts_at",
                filter=Q(bookings__status=Booking.Status.PRESENT, bookings__session__gym=gym),
            ),
            paid_until=Subquery(
                Payment.objects.filter(gym=gym, user=OuterRef("pk")).order_by("-period_end").values("period_end")[:1]
            ),
        )
        .order_by("last_name", "first_name")
    )


def with_payment_status(users, today=None):
    for u in users:
        u.payment_status = status_from_paid_until(u.paid_until, today)["status"]
    return users


class MemberListView(generics.ListAPIView):
    """Liste des adhérents avec dernière venue et statut de paiement."""

    serializer_class = MemberListSerializer
    permission_classes = [IsCoachOfGym]

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str, description="nom, prénom ou email"),
            OpenApiParameter("payment_status", str, enum=["up_to_date", "late"]),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        qs = members_queryset(require_gym(self.request.user))
        q = self.request.query_params.get("search")
        if q:
            qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q))
        return qs

    def list(self, request, *args, **kwargs):
        users = with_payment_status(list(self.get_queryset()))
        wanted = request.query_params.get("payment_status")
        if wanted:
            users = [u for u in users if u.payment_status == wanted]
        return Response(self.get_serializer(users, many=True).data)


class MemberMembershipView(APIView):
    """Le coach suspend / réactive l'adhésion d'un membre."""

    permission_classes = [IsCoachOfGym]

    @extend_schema(request=MembershipUpdateSerializer, responses={200: MembershipUpdateSerializer})
    def patch(self, request, member_id):
        gym = require_gym(request.user)
        member = get_gym_member_or_404(gym, member_id)
        membership = Membership.objects.get(user=member, gym=gym)
        s = MembershipUpdateSerializer(membership, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class MemberSummaryView(APIView):
    """Fiche adhérent : dernière venue, dernières séances, performances, paiements."""

    permission_classes = [IsCoachOfGym]

    @extend_schema(responses={200: dict})
    def get(self, request, member_id):
        gym = require_gym(request.user)
        member = get_object_or_404(members_queryset(gym), pk=member_id)
        with_payment_status([member])

        bookings = (
            Booking.objects.filter(user=member, session__gym=gym)
            .select_related("session")
            .order_by("-session__starts_at")[:10]
        )
        perfs = (
            PerformanceSet.objects.filter(user=member, exercise__gym=gym)
            .select_related("exercise")
            .order_by("-date", "exercise__name", "set_number")[:30]
        )
        payments = Payment.objects.filter(user=member, gym=gym)[:10]
        since = timezone.now() - timedelta(days=30)
        return Response(
            {
                "member": MemberListSerializer(member).data,
                "attendance_last_30_days": Booking.objects.filter(
                    user=member, session__gym=gym, status=Booking.Status.PRESENT, session__starts_at__gte=since
                ).count(),
                "recent_bookings": [
                    {
                        "id": b.id,
                        "status": b.status,
                        "session": {"id": b.session.id, "title": b.session.title, "starts_at": b.session.starts_at},
                    }
                    for b in bookings
                ],
                "recent_performances": [
                    {
                        "id": p.id,
                        "date": p.date,
                        "exercise": p.exercise_id,
                        "exercise_name": p.exercise.name,
                        "unit": p.exercise.unit,
                        "set_number": p.set_number,
                        "reps": p.reps,
                        "load_kg": float(p.load_kg) if p.load_kg is not None else None,
                        "duration_seconds": p.duration_seconds,
                        "distance_m": p.distance_m,
                    }
                    for p in perfs
                ],
                "payments": [
                    {
                        "id": p.id,
                        "amount_cents": p.amount_cents,
                        "paid_on": p.paid_on,
                        "method": p.method,
                        "period_start": p.period_start,
                        "period_end": p.period_end,
                        "note": p.note,
                    }
                    for p in payments
                ],
            }
        )


class DashboardView(APIView):
    """Tableau de bord coach : présences de la semaine, inactifs depuis N jours, impayés."""

    permission_classes = [IsCoachOfGym]

    @extend_schema(responses={200: dict})
    def get(self, request):
        gym = require_gym(request.user)
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=7)
        tz = timezone.get_current_timezone()

        week_presences = (
            Booking.objects.filter(
                session__gym=gym,
                status=Booking.Status.PRESENT,
                session__starts_at__date__gte=week_start,
                session__starts_at__date__lt=week_end,
            )
            .annotate(day=TruncDate("session__starts_at", tzinfo=tz))
            .values("day")
            .annotate(count=Count("id"))
        )
        by_day = {row["day"]: row["count"] for row in week_presences}
        days = [
            {
                "date": (week_start + timedelta(days=i)).isoformat(),
                "present": by_day.get(week_start + timedelta(days=i), 0),
            }
            for i in range(7)
        ]

        members = with_payment_status(list(members_queryset(gym).filter(membership_status=Membership.Status.ACTIVE)))
        threshold = today - timedelta(days=settings.INACTIVE_DAYS)
        inactive = []
        for m in members:
            last_activity = timezone.localdate(m.last_visit) if m.last_visit else m.joined_at
            if last_activity < threshold:
                inactive.append(m)
        unpaid = [m for m in members if m.payment_status != "up_to_date"]

        today_sessions = (
            Session.objects.filter(gym=gym, starts_at__date=today)
            .exclude(status=Session.Status.DRAFT)
            .annotate(
                booked=Count("bookings", filter=Q(bookings__status__in=Booking.ACTIVE_STATUSES)),
                present=Count("bookings", filter=Q(bookings__status=Booking.Status.PRESENT)),
            )
            .order_by("starts_at")
        )
        return Response(
            {
                "week": {
                    "start": week_start.isoformat(),
                    "days": days,
                    "total_present": sum(d["present"] for d in days),
                },
                "members_count": len(members),
                "inactive_days": settings.INACTIVE_DAYS,
                "inactive_members": MemberListSerializer(inactive, many=True).data,
                "unpaid_members": MemberListSerializer(unpaid, many=True).data,
                "today_sessions": [
                    {
                        "id": s.id,
                        "title": s.title,
                        "starts_at": s.starts_at,
                        "capacity": s.capacity,
                        "booked": s.booked,
                        "present": s.present,
                        "status": s.status,
                    }
                    for s in today_sessions
                ],
            }
        )
