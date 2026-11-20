from rest_framework import serializers

from apps.accounts.models import User

from .models import Gym, Membership


class GymSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gym
        fields = ["id", "name", "address", "invite_code", "cancellation_deadline_hours"]
        read_only_fields = ["id", "invite_code"]


class JoinGymSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=12)

    def validate_code(self, value):
        gym = Gym.objects.filter(invite_code=value.strip().upper()).first()
        if not gym:
            raise serializers.ValidationError("Code d'invitation invalide.")
        return gym


class MemberListSerializer(serializers.ModelSerializer):
    membership_status = serializers.CharField(read_only=True)
    joined_at = serializers.DateField(read_only=True)
    last_visit = serializers.DateTimeField(read_only=True, allow_null=True)
    paid_until = serializers.DateField(read_only=True, allow_null=True)
    payment_status = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "membership_status",
            "joined_at",
            "last_visit",
            "paid_until",
            "payment_status",
        ]


class MembershipUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Membership
        fields = ["status"]
