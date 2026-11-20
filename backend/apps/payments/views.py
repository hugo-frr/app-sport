from drf_spectacular.utils import extend_schema
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import GymScopedMixin, HasGym, require_gym

from .models import Payment
from .serializers import PaymentSerializer
from .services import payment_status


class CoachWriteSelfRead(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or request.user.is_coach


class PaymentViewSet(GymScopedMixin, viewsets.ModelViewSet):
    """Paiements saisis par le coach ; l'adhérent consulte les siens."""

    serializer_class = PaymentSerializer
    permission_classes = [HasGym, CoachWriteSelfRead]
    filterset_fields = ["user", "method"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if self.is_schema_generation():
            return Payment.objects.none()
        user = self.request.user
        qs = Payment.objects.filter(gym=require_gym(user)).select_related("user")
        if not user.is_coach:
            qs = qs.filter(user=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(gym=require_gym(self.request.user), recorded_by=self.request.user)


class MySubscriptionView(APIView):
    """État d'abonnement de l'adhérent connecté."""

    permission_classes = [HasGym]

    @extend_schema(responses={200: dict})
    def get(self, request):
        gym = require_gym(request.user)
        return Response(payment_status(request.user, gym))
