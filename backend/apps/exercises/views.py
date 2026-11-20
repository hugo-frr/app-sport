from django.db.models import ProtectedError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.exceptions import ValidationError

from apps.core.access import CoachWriteMemberRead, GymScopedMixin, require_gym

from .models import Exercise
from .serializers import ExerciseSerializer


class ExerciseViewSet(GymScopedMixin, viewsets.ModelViewSet):
    """Bibliothèque d'exercices — lecture : membres de la salle ; écriture : coach."""

    serializer_class = ExerciseSerializer
    permission_classes = [CoachWriteMemberRead]
    filterset_fields = ["category", "unit"]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ["name", "category"]

    def get_queryset(self):
        if self.is_schema_generation():
            return Exercise.objects.none()
        return Exercise.objects.filter(gym=require_gym(self.request.user))

    def perform_create(self, serializer):
        serializer.save(gym=require_gym(self.request.user), created_by=self.request.user)

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError("Cet exercice est utilisé dans un modèle de séance : retirez-le d'abord.")
