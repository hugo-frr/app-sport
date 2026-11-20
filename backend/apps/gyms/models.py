import secrets

from django.conf import settings
from django.db import models


def generate_invite_code() -> str:
    # 8 caractères sans ambiguïté (pas de 0/O, 1/I)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


class Gym(models.Model):
    name = models.CharField("nom", max_length=150)
    address = models.CharField("adresse", max_length=255, blank=True)
    invite_code = models.CharField("code d'invitation", max_length=12, unique=True, default=generate_invite_code)
    cancellation_deadline_hours = models.PositiveIntegerField(
        "délai de désinscription (heures)",
        default=2,
        help_text="Un adhérent peut se désinscrire jusqu'à X heures avant la séance.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "salle"

    def __str__(self):
        return self.name

    def regenerate_invite_code(self):
        self.invite_code = generate_invite_code()
        self.save(update_fields=["invite_code"])


class Membership(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        SUSPENDED = "suspended", "Suspendu"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    gym = models.ForeignKey(Gym, on_delete=models.CASCADE, related_name="memberships")
    status = models.CharField("statut", max_length=10, choices=Status.choices, default=Status.ACTIVE)
    joined_at = models.DateField("date d'entrée", auto_now_add=True)

    class Meta:
        verbose_name = "adhésion"
        constraints = [models.UniqueConstraint(fields=["user", "gym"], name="unique_membership")]

    def __str__(self):
        return f"{self.user} @ {self.gym}"
