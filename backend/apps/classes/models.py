from django.conf import settings
from django.db import models


class WorkoutTemplate(models.Model):
    gym = models.ForeignKey("gyms.Gym", on_delete=models.CASCADE, related_name="templates")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    name = models.CharField("nom", max_length=120)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "modèle de séance"
        verbose_name_plural = "modèles de séance"
        ordering = ["name"]

    def __str__(self):
        return self.name


class TemplateItem(models.Model):
    template = models.ForeignKey(WorkoutTemplate, on_delete=models.CASCADE, related_name="items")
    exercise = models.ForeignKey("exercises.Exercise", on_delete=models.PROTECT, related_name="template_items")
    order = models.PositiveIntegerField("ordre", default=0)
    sets = models.PositiveIntegerField("séries", default=3)
    reps = models.PositiveIntegerField("répétitions", null=True, blank=True)
    target_load_kg = models.DecimalField("charge cible (kg)", max_digits=6, decimal_places=2, null=True, blank=True)
    target_duration_seconds = models.PositiveIntegerField("temps cible (s)", null=True, blank=True)
    target_distance_m = models.PositiveIntegerField("distance cible (m)", null=True, blank=True)
    rest_seconds = models.PositiveIntegerField("repos (s)", null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "exercice du modèle"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.template} — {self.exercise}"


class Session(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publiée"
        DONE = "done", "Terminée"

    class Kind(models.TextChoices):
        GROUP = "group", "Collective"
        INDIVIDUAL = "individual", "Individuelle"

    gym = models.ForeignKey("gyms.Gym", on_delete=models.CASCADE, related_name="sessions")
    template = models.ForeignKey(
        WorkoutTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name="sessions"
    )
    coach = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="coached_sessions"
    )
    title = models.CharField("titre", max_length=150)
    kind = models.CharField("type", max_length=12, choices=Kind.choices, default=Kind.GROUP)
    starts_at = models.DateTimeField("début")
    duration_minutes = models.PositiveIntegerField("durée (min)", default=60)
    capacity = models.PositiveIntegerField("capacité", default=12)
    status = models.CharField("statut", max_length=10, choices=Status.choices, default=Status.DRAFT)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "séance"
        ordering = ["starts_at"]
        indexes = [models.Index(fields=["gym", "starts_at"])]

    def __str__(self):
        return f"{self.title} — {self.starts_at:%d/%m %H:%M}"


class Booking(models.Model):
    class Status(models.TextChoices):
        BOOKED = "booked", "Inscrit"
        CANCELLED = "cancelled", "Annulé"
        PRESENT = "present", "Présent"
        ABSENT = "absent", "Absent"

    ACTIVE_STATUSES = (Status.BOOKED, Status.PRESENT, Status.ABSENT)

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="bookings")
    status = models.CharField("statut", max_length=10, choices=Status.choices, default=Status.BOOKED)
    booked_at = models.DateTimeField("date d'inscription", auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "inscription"
        ordering = ["session__starts_at"]
        constraints = [models.UniqueConstraint(fields=["user", "session"], name="unique_booking")]

    def __str__(self):
        return f"{self.user} → {self.session} ({self.status})"
