from rest_framework import serializers

from .models import Exercise


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = ["id", "name", "category", "unit", "higher_is_better", "video_url", "description", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        gym = self.context["gym"]
        qs = Exercise.objects.filter(gym=gym, name__iexact=value.strip())
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Un exercice porte déjà ce nom.")
        return value.strip()
