import django_filters
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    GymScopedMixin,
    HasGym,
    IsSelfOrCoach,
    require_gym,
    resolve_member,
)
from apps.exercises.models import Exercise

from . import services
from .models import PerformanceSet
from .serializers import PerformanceSetSerializer


class PerformanceFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = PerformanceSet
        fields = ["user", "exercise", "booking", "date"]


class PerformanceSetViewSet(GymScopedMixin, viewsets.ModelViewSet):
    """Séries réalisées. Adhérent : les siennes ; coach : toute sa salle."""

    serializer_class = PerformanceSetSerializer
    permission_classes = [HasGym, IsSelfOrCoach]
    filterset_class = PerformanceFilter
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if self.is_schema_generation():
            return PerformanceSet.objects.none()
        user = self.request.user
        gym = require_gym(user)
        qs = PerformanceSet.objects.filter(exercise__gym=gym).select_related("exercise")
        if not user.is_coach:
            qs = qs.filter(user=user)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save(recorded_by=self.request.user)
        obj._record = services.detect_record(obj)


class LastPerformanceView(APIView):
    """'La dernière fois' pour un ou plusieurs exercices : ?exercise=1,2,3[&user=id][&before=YYYY-MM-DD]."""

    permission_classes = [HasGym]

    @extend_schema(
        parameters=[
            OpenApiParameter("exercise", str, required=True, description="id ou liste d'ids séparés par des virgules"),
            OpenApiParameter("user", str, description="coach : id de l'adhérent ; défaut : moi"),
            OpenApiParameter("before", str, description="exclut ce jour et les suivants (YYYY-MM-DD)"),
        ],
        responses={200: dict},
    )
    def get(self, request):
        member, gym = resolve_member(request, request.query_params.get("user") or "me")
        raw = request.query_params.get("exercise", "")
        try:
            ids = [int(x) for x in raw.split(",") if x.strip()]
        except ValueError:
            raise ValidationError({"exercise": "Liste d'ids invalide."})
        if not ids:
            raise ValidationError({"exercise": "Paramètre requis."})
        before = request.query_params.get("before")
        exercises = Exercise.objects.filter(gym=gym, pk__in=ids)
        return Response({str(e.id): services.last_performance(member, e, before=before) for e in exercises})


class ProgressView(APIView):
    """Progression : sans ?exercise → liste des exercices pratiqués ; avec → séries agrégées pour les graphes."""

    @extend_schema(parameters=[OpenApiParameter("exercise", int)], responses={200: dict})
    def get(self, request, member_id):
        member, gym = resolve_member(request, member_id)
        exercise_id = request.query_params.get("exercise")
        if not exercise_id:
            return Response({"exercises": services.exercises_overview(member, gym)})
        if not str(exercise_id).isdigit():
            raise ValidationError({"exercise": "Id invalide."})
        exercise = get_object_or_404(Exercise, pk=exercise_id, gym=gym)
        return Response(services.progress_for_exercise(member, exercise))
