from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.accounts import views as accounts
from apps.classes import views as classes
from apps.exercises.views import ExerciseViewSet
from apps.gyms import views as gyms
from apps.payments import views as payments
from apps.performances import views as performances

router = DefaultRouter(trailing_slash=False)
router.register("exercises", ExerciseViewSet, basename="exercise")
router.register("templates", classes.WorkoutTemplateViewSet, basename="template")
router.register("sessions", classes.SessionViewSet, basename="session")
router.register("bookings", classes.BookingViewSet, basename="booking")
router.register("performances", performances.PerformanceSetViewSet, basename="performance")
router.register("payments", payments.PaymentViewSet, basename="payment")

api_v1 = [
    path("auth/register", accounts.RegisterView.as_view(), name="register"),
    path("auth/token", accounts.TokenView.as_view(), name="token"),
    path("auth/token/refresh", accounts.RefreshView.as_view(), name="token-refresh"),
    path("auth/me", accounts.MeView.as_view(), name="me"),
    path("auth/me/password", accounts.ChangePasswordView.as_view(), name="change-password"),
    path("auth/me/export", accounts.ExportView.as_view(), name="export"),
    path("gyms/join", gyms.JoinGymView.as_view(), name="gym-join"),
    path("gyms/mine", gyms.MyGymView.as_view(), name="gym-mine"),
    path("gyms/mine/regenerate-code", gyms.regenerate_invite_code, name="gym-regenerate-code"),
    path("members", gyms.MemberListView.as_view(), name="member-list"),
    path("members/<str:member_id>/progress", performances.ProgressView.as_view(), name="member-progress"),
    path("members/<int:member_id>/summary", gyms.MemberSummaryView.as_view(), name="member-summary"),
    path("members/<int:member_id>/membership", gyms.MemberMembershipView.as_view(), name="member-membership"),
    path("performances/last", performances.LastPerformanceView.as_view(), name="performance-last"),
    path("subscription", payments.MySubscriptionView.as_view(), name="subscription"),
    path("dashboard", gyms.DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", lambda request: JsonResponse({"status": "ok"})),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

admin.site.site_header = "App Sport — back-office coach"
admin.site.site_title = "App Sport"
