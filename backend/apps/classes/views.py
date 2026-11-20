from django.db.models import Count, Prefetch, Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.access import (
    CoachWriteMemberRead,
    GymScopedMixin,
    HasGym,
    IsCoachOfGym,
    require_gym,
)

from . import services
from .filters import BookingFilter, SessionFilter
from .models import Booking, Session, WorkoutTemplate
from .serializers import (
    AttendanceUpdateSerializer,
    AttendeeSerializer,
    BookingSerializer,
    SessionDetailSerializer,
    SessionSerializer,
    WorkoutTemplateSerializer,
)


class WorkoutTemplateViewSet(GymScopedMixin, viewsets.ModelViewSet):
    """Modèles de séance (coach uniquement)."""

    serializer_class = WorkoutTemplateSerializer
    permission_classes = [IsCoachOfGym]

    def get_queryset(self):
        if self.is_schema_generation():
            return WorkoutTemplate.objects.none()
        return WorkoutTemplate.objects.filter(gym=require_gym(self.request.user)).prefetch_related("items__exercise")

    def perform_create(self, serializer):
        serializer.save(gym=require_gym(self.request.user), created_by=self.request.user)


def annotate_sessions(qs, user):
    return (
        qs.select_related("gym", "coach", "template")
        .annotate(booked_count=Count("bookings", filter=Q(bookings__status__in=Booking.ACTIVE_STATUSES)))
        .prefetch_related(Prefetch("bookings", queryset=Booking.objects.filter(user=user), to_attr="_my_bookings"))
    )


class SessionViewSet(GymScopedMixin, viewsets.ModelViewSet):
    """Planning. Lecture : membres (séances publiées/terminées) ; écriture : coach."""

    permission_classes = [CoachWriteMemberRead]
    filterset_class = SessionFilter

    def get_serializer_class(self):
        return SessionDetailSerializer if self.action == "retrieve" else SessionSerializer

    def get_queryset(self):
        if self.is_schema_generation():
            return Session.objects.none()
        user = self.request.user
        qs = Session.objects.filter(gym=require_gym(user))
        if not user.is_coach:
            qs = qs.exclude(status=Session.Status.DRAFT)
        if self.action == "retrieve":
            qs = qs.prefetch_related("template__items__exercise")
        return annotate_sessions(qs, user)

    def perform_create(self, serializer):
        serializer.save(gym=require_gym(self.request.user), coach=self.request.user)

    def perform_destroy(self, instance):
        if instance.bookings.filter(status__in=Booking.ACTIVE_STATUSES).exists():
            raise ValidationError(
                "Des adhérents sont inscrits : annulez plutôt la séance en la repassant en brouillon."
            )
        instance.delete()

    def _fresh(self, pk):
        return annotate_sessions(Session.objects.filter(pk=pk), self.request.user).get()

    @extend_schema(request=None, responses={201: SessionSerializer})
    @action(detail=True, methods=["post"], permission_classes=[HasGym])
    def book(self, request, pk=None):
        session = self.get_object()  # 404 si hors de la salle ou brouillon (adhérent)
        services.book_session(request.user, session.pk)
        return Response(
            SessionSerializer(self._fresh(session.pk), context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=None, responses={200: SessionSerializer})
    @action(detail=True, methods=["post"], permission_classes=[HasGym])
    def cancel(self, request, pk=None):
        session = self.get_object()
        services.cancel_booking(request.user, session.pk)
        return Response(SessionSerializer(self._fresh(session.pk), context=self.get_serializer_context()).data)

    @extend_schema(methods=["GET"], responses={200: AttendeeSerializer(many=True)})
    @extend_schema(methods=["POST"], request=AttendanceUpdateSerializer, responses={200: AttendeeSerializer(many=True)})
    @action(detail=True, methods=["get", "post"], permission_classes=[IsCoachOfGym])
    def attendance(self, request, pk=None):
        session = self.get_object()
        if request.method == "POST":
            s = AttendanceUpdateSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            services.record_attendance(session, s.validated_data["attendees"], s.validated_data["close"])
        bookings = (
            session.bookings.exclude(status=Booking.Status.CANCELLED)
            .select_related("user")
            .order_by("user__last_name", "user__first_name")
        )
        return Response(AttendeeSerializer(bookings, many=True).data)


class BookingViewSet(GymScopedMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Historique des inscriptions : l'adhérent voit les siennes, le coach celles de sa salle."""

    serializer_class = BookingSerializer
    permission_classes = [HasGym]
    filterset_class = BookingFilter

    def get_queryset(self):
        if self.is_schema_generation():
            return Booking.objects.none()
        user = self.request.user
        gym = require_gym(user)
        qs = Booking.objects.filter(session__gym=gym).select_related(
            "session__gym", "session__coach", "session__template"
        )
        if not user.is_coach:
            qs = qs.filter(user=user)
        return qs.order_by("-session__starts_at")
