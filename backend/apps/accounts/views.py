from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.classes.models import Booking
from apps.gyms.models import Membership
from apps.payments.models import Payment
from apps.performances.models import PerformanceSet

from .serializers import (
    ChangePasswordSerializer,
    DeleteAccountSerializer,
    EmailTokenObtainPairSerializer,
    MeSerializer,
    RegisterSerializer,
)


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(AuthThrottleMixin, generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes: list = []


class TokenView(AuthThrottleMixin, TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class RefreshView(AuthThrottleMixin, TokenRefreshView):
    pass


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user

    @extend_schema(request=DeleteAccountSerializer, responses={204: None})
    def delete(self, request):
        """Suppression du compte (RGPD) — confirmée par le mot de passe."""
        s = DeleteAccountSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChangePasswordView(APIView):
    @extend_schema(request=ChangePasswordSerializer, responses={204: None})
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        request.user.set_password(s.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExportView(APIView):
    """Export de toutes les données personnelles (RGPD, droit à la portabilité)."""

    @extend_schema(responses={200: dict})
    def get(self, request):
        u = request.user
        data = {
            "profile": MeSerializer(u).data,
            "memberships": list(Membership.objects.filter(user=u).values("gym__name", "status", "joined_at")),
            "bookings": list(
                Booking.objects.filter(user=u).values("session__title", "session__starts_at", "status", "booked_at")
            ),
            "performances": list(
                PerformanceSet.objects.filter(user=u).values(
                    "date", "exercise__name", "set_number", "reps", "load_kg", "duration_seconds", "distance_m", "rpe"
                )
            ),
            "payments": list(
                Payment.objects.filter(user=u).values(
                    "gym__name", "amount_cents", "paid_on", "method", "period_start", "period_end", "note"
                )
            ),
        }
        resp = Response(data)
        resp["Content-Disposition"] = 'attachment; filename="mes-donnees.json"'
        return resp
