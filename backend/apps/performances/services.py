"""Calculs de progression — uniquement sur le réalisé (PerformanceSet)."""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, F, Max, Min, Q, Sum

from apps.exercises.models import Exercise

from .models import PerformanceSet


def epley_1rm(load_kg, reps) -> Decimal | None:
    """1RM estimé (Epley) = charge × (1 + reps / 30). Une série à 1 rep vaut la charge elle-même."""
    if not load_kg or not reps:
        return None
    load = Decimal(load_kg)
    if reps == 1:
        return load
    return (load * (1 + Decimal(reps) / 30)).quantize(Decimal("0.1"))


def _num(v):
    return float(v) if v is not None else None


def set_score(exercise: Exercise, s: PerformanceSet):
    """Valeur comparée pour détecter un record, selon l'unité de l'exercice."""
    if exercise.unit == Exercise.Unit.KG_REPS:
        # charge si l'exercice est chargé, sinon répétitions (tractions, pompes…)
        if s.load_kg:
            return ("load_kg", Decimal(s.load_kg))
        return ("reps", Decimal(s.reps or 0)) if s.reps else (None, None)
    if exercise.unit == Exercise.Unit.TIME:
        return ("duration_seconds", Decimal(s.duration_seconds)) if s.duration_seconds else (None, None)
    return ("distance_m", Decimal(s.distance_m)) if s.distance_m else (None, None)


def detect_record(new_set: PerformanceSet) -> dict | None:
    """Record personnel = nouvelle série qui dépasse strictement le meilleur historique."""
    exercise = new_set.exercise
    metric, value = set_score(exercise, new_set)
    if metric is None:
        return None
    previous = (
        PerformanceSet.objects.filter(user=new_set.user, exercise=exercise)
        .exclude(pk=new_set.pk)
        .exclude(**{f"{metric}__isnull": True})
    )
    if metric == "reps":  # exercice au poids du corps : on ne compare qu'aux séries sans charge
        previous = previous.filter(Q(load_kg__isnull=True) | Q(load_kg=0))
    elif metric == "load_kg":
        previous = previous.filter(load_kg__gt=0)
    lower_is_better = metric == "duration_seconds" and not exercise.higher_is_better
    best = previous.aggregate(best=Min(metric) if lower_is_better else Max(metric))["best"]
    if best is None:
        return None  # première série : pas de "record" à célébrer
    beaten = value < best if lower_is_better else value > best
    if beaten:
        return {"metric": metric, "value": float(value), "previous": float(best)}
    return None


def progress_for_exercise(user, exercise: Exercise) -> dict:
    qs = PerformanceSet.objects.filter(user=user, exercise=exercise)

    # Agrégations par jour via l'ORM
    per_day = {
        row["date"]: row
        for row in qs.values("date")
        .annotate(
            max_load=Max("load_kg"),
            volume=Sum(F("reps") * F("load_kg")),
            total_reps=Sum("reps"),
            max_reps=Max("reps"),
            max_duration=Max("duration_seconds"),
            total_distance=Sum("distance_m"),
            max_distance=Max("distance_m"),
        )
        .order_by("date")
    }
    min_durations = dict(qs.values("date").annotate(m=Min("duration_seconds")).values_list("date", "m"))

    # 1RM estimé : calcul par série, max par jour
    e1rm_by_day: dict = defaultdict(lambda: None)
    for s in qs.exclude(load_kg__isnull=True).exclude(reps__isnull=True).only("date", "load_kg", "reps"):
        e = epley_1rm(s.load_kg, s.reps)
        if e is not None and (e1rm_by_day[s.date] is None or e > e1rm_by_day[s.date]):
            e1rm_by_day[s.date] = e

    points = []
    for day, row in per_day.items():
        best_duration = row["max_duration"] if exercise.higher_is_better else min_durations.get(day)
        points.append(
            {
                "date": day.isoformat(),
                "max_load": _num(row["max_load"]),
                "volume": _num(row["volume"]),
                "estimated_1rm": _num(e1rm_by_day.get(day)),
                "total_reps": row["total_reps"],
                "max_reps": row["max_reps"],
                "best_duration": best_duration,
                "max_distance": row["max_distance"],
                "total_distance": row["total_distance"],
            }
        )

    def best(key, lower=False):
        candidates = [p for p in points if p[key] is not None]
        if not candidates:
            return None
        p = (min if lower else max)(candidates, key=lambda p: p[key])
        return {"value": p[key], "date": p["date"]}

    records = {
        "max_load": best("max_load"),
        "estimated_1rm": best("estimated_1rm"),
        "max_volume": best("volume"),
        "max_reps": best("max_reps"),
        "best_duration": best("best_duration", lower=not exercise.higher_is_better),
        "max_distance": best("max_distance"),
    }
    return {
        "exercise": {
            "id": exercise.id,
            "name": exercise.name,
            "unit": exercise.unit,
            "higher_is_better": exercise.higher_is_better,
        },
        "points": points,
        "records": records,
        "sessions_count": len(points),
        "last": last_performance(user, exercise),
    }


def last_performance(user, exercise: Exercise, before=None) -> dict | None:
    """Séries du dernier jour où l'exercice a été fait ("la dernière fois : 3 × 8 à 60 kg")."""
    qs = PerformanceSet.objects.filter(user=user, exercise=exercise)
    if before:
        qs = qs.filter(date__lt=before)
    last_date = qs.aggregate(d=Max("date"))["d"]
    if not last_date:
        return None
    sets = qs.filter(date=last_date).order_by("set_number", "id")
    return {
        "date": last_date.isoformat(),
        "sets": [
            {
                "set_number": s.set_number,
                "reps": s.reps,
                "load_kg": _num(s.load_kg),
                "duration_seconds": s.duration_seconds,
                "distance_m": s.distance_m,
            }
            for s in sets
        ],
    }


def exercises_overview(user, gym) -> list[dict]:
    """Liste des exercices pratiqués par l'adhérent avec dernier jour et nombre de séances."""
    rows = (
        PerformanceSet.objects.filter(user=user, exercise__gym=gym)
        .values("exercise_id", "exercise__name", "exercise__category", "exercise__unit")
        .annotate(last_date=Max("date"), days=Count("date", distinct=True), max_load=Max("load_kg"))
        .order_by("-last_date")
    )
    return [
        {
            "exercise": r["exercise_id"],
            "name": r["exercise__name"],
            "category": r["exercise__category"],
            "unit": r["exercise__unit"],
            "last_date": r["last_date"].isoformat(),
            "sessions_count": r["days"],
            "max_load": _num(r["max_load"]),
        }
        for r in rows
    ]
