from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.access import get_current_gym
from apps.gyms.models import Gym, Membership

from .models import User


class GymBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gym
        fields = ["id", "name", "address", "cancellation_deadline_hours"]


class MyGymSerializer(GymBriefSerializer):
    invite_code = serializers.CharField(required=False, help_text="Visible par le coach uniquement.")

    class Meta(GymBriefSerializer.Meta):
        fields = [*GymBriefSerializer.Meta.fields, "invite_code"]


class MeSerializer(serializers.ModelSerializer):
    gym = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "phone", "role", "gym", "date_joined"]
        read_only_fields = ["id", "email", "role", "gym", "date_joined"]

    @extend_schema_field(MyGymSerializer(allow_null=True))
    def get_gym(self, user):
        gym = get_current_gym(user)
        if not gym:
            return None
        data = GymBriefSerializer(gym).data
        if user.is_coach:
            data["invite_code"] = gym.invite_code
        return data


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    invite_code = serializers.CharField(
        required=False, allow_blank=True, help_text="Adhérent : code d'invitation de la salle."
    )
    gym_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150, help_text="Coach : crée une nouvelle salle."
    )

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet email.")
        return value

    def validate(self, attrs):
        if attrs.get("invite_code") and attrs.get("gym_name"):
            raise serializers.ValidationError("Choisissez entre rejoindre une salle et en créer une.")
        code = (attrs.get("invite_code") or "").strip().upper()
        if code:
            gym = Gym.objects.filter(invite_code=code).first()
            if not gym:
                raise serializers.ValidationError({"invite_code": "Code d'invitation invalide."})
            attrs["_gym"] = gym
        validate_password(attrs["password"], User(email=attrs["email"], first_name=attrs["first_name"]))
        return attrs

    @transaction.atomic
    def create(self, data):
        gym = data.pop("_gym", None)
        gym_name = (data.pop("gym_name", "") or "").strip()
        data.pop("invite_code", None)
        role = User.Role.COACH if gym_name else User.Role.MEMBER
        user = User.objects.create_user(role=role, **data)
        if gym_name:
            gym = Gym.objects.create(name=gym_name)
        if gym:
            Membership.objects.create(user=user, gym=gym)
        return user

    def to_representation(self, user):
        refresh = RefreshToken.for_user(user)
        return {"user": MeSerializer(user).data, "access": str(refresh.access_token), "refresh": str(refresh)}


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        attrs[self.username_field] = attrs[self.username_field].lower().strip()
        return super().validate(attrs)


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField()

    def validate_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Mot de passe incorrect.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        user = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Mot de passe incorrect."})
        validate_password(attrs["new_password"], user)
        return attrs
