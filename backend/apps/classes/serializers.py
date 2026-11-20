from datetime import datetime, timedelta

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.exercises.models import Exercise

from .models import Booking, Session, TemplateItem, WorkoutTemplate


class TemplateItemSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    exercise_unit = serializers.CharField(source="exercise.unit", read_only=True)
    exercise_video_url = serializers.CharField(source="exercise.video_url", read_only=True)

    class Meta:
        model = TemplateItem
        fields = [
            "id",
            "exercise",
            "exercise_name",
            "exercise_unit",
            "exercise_video_url",
            "order",
            "sets",
            "reps",
            "target_load_kg",
            "target_duration_seconds",
            "target_distance_m",
            "rest_seconds",
            "notes",
        ]
        read_only_fields = ["id"]


class WorkoutTemplateSerializer(serializers.ModelSerializer):
    items = TemplateItemSerializer(many=True, required=False)

    class Meta:
        model = WorkoutTemplate
        fields = ["id", "name", "description", "items", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_items(self, items):
        gym = self.context["gym"]
        for item in items:
            if item["exercise"].gym_id != gym.id:
                raise serializers.ValidationError("Exercice inconnu.")
        return items

    def _write_items(self, template, items):
        template.items.all().delete()
        TemplateItem.objects.bulk_create(
            [TemplateItem(template=template, **{**item, "order": item.get("order", i)}) for i, item in enumerate(items)]
        )

    @transaction.atomic
    def create(self, validated):
        items = validated.pop("items", [])
        template = WorkoutTemplate.objects.create(**validated)
        self._write_items(template, items)
        return template

    @transaction.atomic
    def update(self, instance, validated):
        items = validated.pop("items", None)
        instance = super().update(instance, validated)
        if items is not None:  # la liste envoyée remplace l'ancienne (ordre compris)
            self._write_items(instance, items)
        return instance

    def get_fields(self):
        fields = super().get_fields()
        gym = self.context.get("gym")
        if gym is not None:
            fields["items"].child.fields["exercise"].queryset = Exercise.objects.filter(gym=gym)
        return fields


class MyBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ["id", "status", "booked_at"]


class SessionSerializer(serializers.ModelSerializer):
    coach_name = serializers.CharField(source="coach.full_name", read_only=True, default=None)
    template_name = serializers.CharField(source="template.name", read_only=True, default=None)
    booked_count = serializers.IntegerField(read_only=True)
    spots_left = serializers.SerializerMethodField()
    my_booking = serializers.SerializerMethodField()
    can_cancel_until = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            "id",
            "title",
            "kind",
            "starts_at",
            "duration_minutes",
            "capacity",
            "status",
            "notes",
            "template",
            "template_name",
            "coach",
            "coach_name",
            "booked_count",
            "spots_left",
            "my_booking",
            "can_cancel_until",
        ]
        read_only_fields = ["id", "coach"]

    def get_fields(self):
        fields = super().get_fields()
        gym = self.context.get("gym")
        if gym is not None:
            fields["template"].queryset = WorkoutTemplate.objects.filter(gym=gym)
        return fields

    def get_spots_left(self, obj) -> int:
        return max(obj.capacity - (getattr(obj, "booked_count", None) or 0), 0)

    @extend_schema_field(MyBookingSerializer(allow_null=True))
    def get_my_booking(self, obj):
        user = self.context["request"].user
        cache = getattr(obj, "_my_bookings", None)  # préchargé par annotate_sessions
        if cache is None:
            booking = obj.bookings.filter(user=user).first()
        else:
            booking = cache[0] if cache else None
        return MyBookingSerializer(booking).data if booking else None

    def get_can_cancel_until(self, obj) -> datetime:
        return obj.starts_at - timedelta(hours=obj.gym.cancellation_deadline_hours)

    def validate(self, attrs):
        if attrs.get("kind") == Session.Kind.INDIVIDUAL and "capacity" not in attrs:
            attrs["capacity"] = 1
        starts_at = attrs.get("starts_at")
        if starts_at and not self.instance and starts_at < timezone.now() and attrs.get("status") == "published":
            raise serializers.ValidationError({"starts_at": "Impossible de publier une séance dans le passé."})
        return attrs


class SessionDetailSerializer(SessionSerializer):
    items = TemplateItemSerializer(source="template.items", many=True, read_only=True, default=[])

    class Meta(SessionSerializer.Meta):
        fields = [*SessionSerializer.Meta.fields, "items"]


class AttendeeSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "user_id", "first_name", "last_name", "email", "status", "booked_at"]


class AttendanceEntrySerializer(serializers.Serializer):
    user = serializers.IntegerField()
    present = serializers.BooleanField()


class AttendanceUpdateSerializer(serializers.Serializer):
    attendees = AttendanceEntrySerializer(many=True)
    close = serializers.BooleanField(default=False, help_text="Clôture la séance : les non-pointés passent absents.")


class BookingSessionSerializer(serializers.ModelSerializer):
    coach_name = serializers.CharField(source="coach.full_name", read_only=True, default=None)

    class Meta:
        model = Session
        fields = ["id", "title", "kind", "starts_at", "duration_minutes", "status", "template", "coach_name"]


class BookingSerializer(serializers.ModelSerializer):
    session = BookingSessionSerializer(read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "user_id", "status", "booked_at", "session"]
