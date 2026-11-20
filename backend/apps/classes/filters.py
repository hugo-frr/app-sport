import django_filters

from .models import Booking, Session


class SessionFilter(django_filters.FilterSet):
    date = django_filters.DateFilter(field_name="starts_at", lookup_expr="date")
    date_from = django_filters.DateFilter(field_name="starts_at", lookup_expr="date__gte")
    date_to = django_filters.DateFilter(field_name="starts_at", lookup_expr="date__lte")
    upcoming = django_filters.BooleanFilter(method="filter_upcoming")

    class Meta:
        model = Session
        fields = ["status", "kind", "template"]

    def filter_upcoming(self, qs, name, value):
        from django.utils import timezone

        if value is None:
            return qs
        return qs.filter(starts_at__gte=timezone.now()) if value else qs.filter(starts_at__lt=timezone.now())


class BookingFilter(django_filters.FilterSet):
    class Meta:
        model = Booking
        fields = ["status", "session", "user"]
