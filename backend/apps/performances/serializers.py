from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import User
from apps.classes.models import Booking
from apps.exercises.models import Exercise

from .models import PerformanceSet


class RecordSerializer(serializers.Serializer):
    metric = serializers.CharField()
    value = serializers.FloatField()
    previous = serializers.FloatField()


class PerformanceSetSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.none(),
        required=False,
        help_text="Coach uniquement : saisie pour un adhérent. Ignoré pour un adhérent (toujours lui-même).",
    )
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    exercise_unit = serializers.CharField(source="exercise.unit", read_only=True)
    date = serializers.DateField(required=False)
    record = serializers.SerializerMethodField()

    class Meta:
        model = PerformanceSet
        fields = [
            "id",
            "user",
            "exercise",
            "exercise_name",
            "exercise_unit",
            "booking",
            "date",
            "set_number",
            "reps",
            "load_kg",
            "duration_seconds",
            "distance_m",
            "rpe",
            "recorded_by",
            "created_at",
            "record",
        ]
        read_only_fields = ["id", "recorded_by", "created_at"]

    def get_fields(self):
        fields = super().get_fields()
        gym = self.context.get("gym")
        if gym is not None:
            fields["user"].queryset = User.objects.filter(memberships__gym=gym)
            fields["exercise"].queryset = Exercise.objects.filter(gym=gym)
            fields["booking"].queryset = Booking.objects.filter(session__gym=gym)
        return fields

    @extend_schema_field(RecordSerializer(allow_null=True))
    def get_record(self, obj):
        return getattr(obj, "_record", None)

    def validate(self, attrs):
        request = self.context["request"]
        if self.instance is None:
            if not request.user.is_coach or "user" not in attrs:
                attrs["user"] = request.user  # un adhérent saisit toujours pour lui-même
            attrs.setdefault("date", timezone.localdate())
        user = attrs.get("user", getattr(self.instance, "user", None))
        exercise = attrs.get("exercise", getattr(self.instance, "exercise", None))
        booking = attrs.get("booking", getattr(self.instance, "booking", None))

        if booking is not None:
            if booking.user_id != user.id:
                raise serializers.ValidationError({"booking": "Cette inscription n'appartient pas à cet adhérent."})
            if "date" not in self.initial_data:
                attrs["date"] = timezone.localdate(booking.session.starts_at)

        merged = {
            f: attrs.get(f, getattr(self.instance, f, None))
            for f in ("reps", "load_kg", "duration_seconds", "distance_m")
        }
        if exercise.unit == Exercise.Unit.KG_REPS and not merged["reps"]:
            raise serializers.ValidationError({"reps": "Nombre de répétitions requis."})
        if exercise.unit == Exercise.Unit.TIME and not merged["duration_seconds"]:
            raise serializers.ValidationError({"duration_seconds": "Temps requis."})
        if exercise.unit == Exercise.Unit.DISTANCE and not merged["distance_m"]:
            raise serializers.ValidationError({"distance_m": "Distance requise."})
        if attrs.get("rpe") is not None and not (1 <= attrs["rpe"] <= 10):
            raise serializers.ValidationError({"rpe": "Le RPE est compris entre 1 et 10."})
        return attrs
