from django.conf import settings
from django.db import models


class PerformanceSet(models.Model):
    """Le réalisé, série par série. Utilisable sans séance (entraînement libre)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="performance_sets")
    exercise = models.ForeignKey("exercises.Exercise", on_delete=models.CASCADE, related_name="performance_sets")
    booking = models.ForeignKey(
        "classes.Booking", on_delete=models.SET_NULL, null=True, blank=True, related_name="performance_sets"
    )
    date = models.DateField()
    set_number = models.PositiveIntegerField("n° de série", default=1)
    reps = models.PositiveIntegerField(null=True, blank=True)
    load_kg = models.DecimalField("charge (kg)", max_digits=6, decimal_places=2, null=True, blank=True)
    duration_seconds = models.PositiveIntegerField("temps (s)", null=True, blank=True)
    distance_m = models.PositiveIntegerField("distance (m)", null=True, blank=True)
    rpe = models.DecimalField("RPE", max_digits=3, decimal_places=1, null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "série réalisée"
        verbose_name_plural = "séries réalisées"
        ordering = ["-date", "exercise", "set_number"]
        indexes = [models.Index(fields=["user", "exercise", "date"])]

    def __str__(self):
        return f"{self.user} {self.exercise} {self.date} #{self.set_number}"
