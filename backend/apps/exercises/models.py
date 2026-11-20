from django.conf import settings
from django.db import models


class Exercise(models.Model):
    class Unit(models.TextChoices):
        KG_REPS = "kg_reps", "Charge × répétitions"
        TIME = "time", "Temps"
        DISTANCE = "distance", "Distance"

    gym = models.ForeignKey("gyms.Gym", on_delete=models.CASCADE, related_name="exercises")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    name = models.CharField("nom", max_length=120)
    category = models.CharField("catégorie / groupe musculaire", max_length=80, blank=True)
    unit = models.CharField("unité", max_length=10, choices=Unit.choices, default=Unit.KG_REPS)
    higher_is_better = models.BooleanField(
        "plus c'est haut, mieux c'est",
        default=True,
        help_text="Décocher pour les exercices chronométrés où un temps plus court est meilleur (ex : 500 m rameur).",
    )
    video_url = models.URLField("vidéo", blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "exercice"
        ordering = ["category", "name"]
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_exercise_name_per_gym")]

    def __str__(self):
        return self.name
