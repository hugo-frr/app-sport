from rest_framework import serializers

from apps.accounts.models import User

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "user",
            "user_name",
            "amount_cents",
            "paid_on",
            "method",
            "period_start",
            "period_end",
            "note",
            "recorded_by",
            "created_at",
        ]
        read_only_fields = ["id", "recorded_by", "created_at"]

    def get_fields(self):
        fields = super().get_fields()
        gym = self.context.get("gym")
        if gym is not None:
            fields["user"].queryset = User.objects.filter(memberships__gym=gym)
        return fields

    def validate_amount_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value

    def validate(self, attrs):
        start = attrs.get("period_start", getattr(self.instance, "period_start", None))
        end = attrs.get("period_end", getattr(self.instance, "period_end", None))
        if start and end and end < start:
            raise serializers.ValidationError({"period_end": "La fin de période précède le début."})
        return attrs
