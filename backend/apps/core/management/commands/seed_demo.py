"""Données de démonstration : une salle, un coach, des adhérents (dont Bruno Ferré) et un historique complet.

Chaque adhérent a un profil (niveau, assiduité, paiements) qui produit des données cohérentes :
inscriptions et présences sur 8 semaines, performances sur tous les exercices, entraînements libres,
séances à venir et paiements. Les données sont déterministes (graine aléatoire fixe).
"""

import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.classes.models import Booking, Session, TemplateItem, WorkoutTemplate
from apps.exercises.models import Exercise
from apps.gyms.models import Gym, Membership
from apps.payments.models import Payment
from apps.performances.models import PerformanceSet

PASSWORD = "demo-sport-2026"
GYM_NAME = "Salle Démo"
HISTORY_WEEKS = 8

# nom, catégorie, unité, plus haut = mieux, vidéo, consignes
EXERCISES = [
    (
        "Squat",
        "Jambes",
        "kg_reps",
        True,
        "https://www.youtube.com/watch?v=ultWZbUMPL8",
        "Dos droit, cuisses parallèles au sol.",
    ),
    ("Fentes", "Jambes", "kg_reps", True, "", "Genou arrière proche du sol, buste droit."),
    (
        "Soulevé de terre",
        "Dos",
        "kg_reps",
        True,
        "https://www.youtube.com/watch?v=op9kVnSso6Q",
        "Barre collée aux tibias, dos gainé.",
    ),
    ("Rowing barre", "Dos", "kg_reps", True, "", "Buste penché à 45°, tirer vers le nombril."),
    ("Tractions", "Dos", "kg_reps", True, "", "Poids du corps, menton au-dessus de la barre."),
    (
        "Développé couché",
        "Pectoraux",
        "kg_reps",
        True,
        "https://www.youtube.com/watch?v=rT7DgCr-3pg",
        "Omoplates serrées, pieds au sol.",
    ),
    ("Pompes", "Pectoraux", "kg_reps", True, "", "Corps aligné, poitrine au sol."),
    ("Développé militaire", "Épaules", "kg_reps", True, "", "Debout, gainage abdominal, barre au-dessus de la tête."),
    ("Rameur 500 m", "Cardio", "time", False, "", "Chrono sur 500 m : plus le temps est court, mieux c'est."),
    ("Course", "Cardio", "distance", True, "", "Distance parcourue en 15 minutes."),
    ("Gainage", "Abdos", "time", True, "", "Planche sur les avant-bras, tenir le plus longtemps possible."),
]

# modèle → [(exercice, séries, reps, charge cible kg, durée cible s, distance cible m, repos s)]
TEMPLATES = {
    "Force — full body": (
        "Les grands mouvements polyarticulaires.",
        [
            ("Squat", 4, 6, 70, None, None, 150),
            ("Développé couché", 4, 8, 50, None, None, 120),
            ("Soulevé de terre", 3, 5, 90, None, None, 180),
            ("Tractions", 3, 8, None, None, None, 90),
        ],
    ),
    "Cardio & gainage": (
        "Intervalles au rameur, course et gainage.",
        [
            ("Rameur 500 m", 4, None, None, 115, None, 90),
            ("Course", 1, None, None, None, 2500, None),
            ("Gainage", 3, None, None, 60, None, 45),
        ],
    ),
    "Haut du corps": (
        "Poussée et tirage.",
        [
            ("Développé militaire", 4, 8, 30, None, None, 90),
            ("Rowing barre", 4, 10, 40, None, None, 90),
            ("Pompes", 3, 15, None, None, None, 60),
            ("Fentes", 3, 10, 20, None, None, 60),
        ],
    ),
}

# Planning hebdomadaire : (jour de la semaine, heure, modèle)
WEEKLY = [(0, "18:30", "Force — full body"), (2, "12:15", "Cardio & gainage"), (4, "18:30", "Haut du corps")]


@dataclass
class Profile:
    email: str
    first_name: str
    last_name: str
    phone: str
    strength: float  # multiplicateur sur les charges cibles
    attendance: float  # probabilité de venir à une séance
    stops_weeks_ago: int | None = None  # n'est plus venu depuis N semaines (adhérent inactif)
    paid_months: int = 3  # nombre de mois payés jusqu'au mois courant
    late: bool = False  # dernier paiement terminé le mois dernier
    free_training: bool = True  # séances d'entraînement libre


PROFILES = [
    Profile("bruno.ferre@demo.fr", "Bruno", "Ferré", "06 12 34 56 78", strength=1.15, attendance=0.92, paid_months=3),
    Profile("adherent1@demo.fr", "Léa", "Martin", "06 11 22 33 44", strength=0.75, attendance=0.85),
    Profile("adherent2@demo.fr", "Hugo", "Bernard", "", strength=1.0, attendance=0.75),
    Profile("adherent3@demo.fr", "Inès", "Petit", "07 55 44 33 22", strength=0.85, attendance=0.9, paid_months=12),
    Profile("adherent4@demo.fr", "Nathan", "Durand", "", strength=1.05, attendance=0.6, late=True, free_training=False),
    Profile("adherent5@demo.fr", "Chloé", "Leroy", "", strength=0.8, attendance=0.8, stops_weeks_ago=4, late=True),
]


def round_load(kg: float) -> Decimal:
    """Arrondi au demi-disque (2,5 kg), minimum 2,5 kg."""
    steps = (Decimal(str(kg)) / Decimal("2.5")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return max(steps, Decimal(1)) * Decimal("2.5")


def month_start(d: date, offset: int) -> date:
    m = d.month - 1 + offset
    return date(d.year + m // 12, m % 12 + 1, 1)


class Command(BaseCommand):
    help = "Crée la salle de démo : coach@demo.fr, bruno.ferre@demo.fr, adherent1..5@demo.fr (mdp : demo-sport-2026)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Supprime d'abord la salle et les comptes de démo.")

    @transaction.atomic
    def handle(self, *args, reset=False, **opts):
        self.rng = random.Random(42)
        if reset:
            # les exercices sont protégés tant qu'ils figurent dans un modèle : on supprime les modèles d'abord
            WorkoutTemplate.objects.filter(gym__name=GYM_NAME).delete()
            Gym.objects.filter(name=GYM_NAME).delete()
            User.objects.filter(email__endswith="@demo.fr").delete()
        if Gym.objects.filter(name=GYM_NAME).exists():
            self.stdout.write(self.style.WARNING("La salle de démo existe déjà (utilisez --reset)."))
            return

        today = timezone.localdate()
        gym = Gym.objects.create(name=GYM_NAME, address="12 rue du Sport, Lyon", invite_code="DEMO2026")
        coach = User.objects.create_user(
            "coach@demo.fr",
            PASSWORD,
            first_name="Camille",
            last_name="Coach",
            role=User.Role.COACH,
            is_staff=True,
            is_superuser=True,
        )
        Membership.objects.create(user=coach, gym=gym)

        members = []
        for p in PROFILES:
            user = User.objects.create_user(
                p.email, PASSWORD, first_name=p.first_name, last_name=p.last_name, phone=p.phone
            )
            Membership.objects.create(user=user, gym=gym)
            members.append((user, p))
        Membership.objects.filter(gym=gym).update(joined_at=today - timedelta(weeks=HISTORY_WEEKS + 4))

        self.exercises = {
            name: Exercise.objects.create(
                gym=gym,
                name=name,
                category=cat,
                unit=unit,
                higher_is_better=hib,
                video_url=video,
                description=desc,
                created_by=coach,
            )
            for name, cat, unit, hib, video, desc in EXERCISES
        }

        templates = {}
        for name, (description, items) in TEMPLATES.items():
            t = WorkoutTemplate.objects.create(gym=gym, name=name, description=description, created_by=coach)
            for order, (ex, sets, reps, load, duration, distance, rest) in enumerate(items):
                TemplateItem.objects.create(
                    template=t,
                    exercise=self.exercises[ex],
                    order=order,
                    sets=sets,
                    reps=reps,
                    target_load_kg=load,
                    target_duration_seconds=duration,
                    target_distance_m=distance,
                    rest_seconds=rest,
                )
            templates[name] = t

        def at(day: date, hhmm: str):
            h, m = map(int, hhmm.split(":"))
            return timezone.make_aware(datetime(day.year, day.month, day.day, h, m))

        monday = today - timedelta(days=today.weekday())
        counts = {"sessions": 0, "bookings": 0, "sets": 0}

        # --- Historique : HISTORY_WEEKS semaines passées + semaine en cours jusqu'à hier
        for week in range(HISTORY_WEEKS, -1, -1):
            for weekday, hhmm, tname in WEEKLY:
                day = monday - timedelta(weeks=week) + timedelta(days=weekday)
                if day >= today:
                    continue
                s = Session.objects.create(
                    gym=gym,
                    coach=coach,
                    template=templates[tname],
                    title=tname,
                    starts_at=at(day, hhmm),
                    capacity=12,
                    status=Session.Status.DONE,
                )
                counts["sessions"] += 1
                progress = HISTORY_WEEKS - week  # 0 → 8 : la forme progresse au fil des semaines
                for user, p in members:
                    if p.stops_weeks_ago is not None and week < p.stops_weeks_ago:
                        continue  # ne vient plus
                    if self.rng.random() > max(p.attendance, 0.5) + 0.05:
                        continue  # pas inscrit cette fois
                    present = self.rng.random() < p.attendance
                    b = Booking.objects.create(
                        user=user, session=s, status=Booking.Status.PRESENT if present else Booking.Status.ABSENT
                    )
                    counts["bookings"] += 1
                    if present:
                        counts["sets"] += self._session_sets(user, p, templates[tname], day, b, progress)

        # --- Entraînements libres (sans séance), un samedi sur deux
        for user, p in members:
            if not p.free_training:
                continue
            for week in range(HISTORY_WEEKS, 0, -2):
                if p.stops_weeks_ago is not None and week < p.stops_weeks_ago:
                    continue
                day = monday - timedelta(weeks=week) + timedelta(days=5)
                progress = HISTORY_WEEKS - week
                counts["sets"] += self._free_sets(user, p, day, progress)

        # --- Planning à venir : aujourd'hui + 13 jours (au-delà de 7 jours : brouillons)
        upcoming = []
        for offset in range(0, 14):
            day = today + timedelta(days=offset)
            for weekday, hhmm, tname in WEEKLY:
                if day.weekday() != weekday and not (offset == 0 and weekday == WEEKLY[0][0]):
                    continue
                s = Session.objects.create(
                    gym=gym,
                    coach=coach,
                    template=templates[tname],
                    title=tname,
                    starts_at=at(day, hhmm),
                    capacity=8,
                    status=Session.Status.PUBLISHED if offset <= 7 else Session.Status.DRAFT,
                    notes="Pensez à votre gourde !" if tname.startswith("Cardio") else "",
                )
                upcoming.append(s)
                counts["sessions"] += 1
        published = [s for s in upcoming if s.status == Session.Status.PUBLISHED]
        for user, p in members:
            if p.stops_weeks_ago is not None:
                continue
            # Bruno est inscrit à la séance du jour (onglet « Ma séance » rempli) et aux suivantes
            picks = (
                published[:4]
                if user.email.startswith("bruno")
                else self.rng.sample(published, k=min(2, len(published)))
            )
            for s in picks:
                Booking.objects.get_or_create(user=user, session=s)
                counts["bookings"] += 1

        # --- Paiements : 45 €/mois (ou 450 €/an) ; Nathan et Chloé en retard
        for user, p in members:
            if p.paid_months == 12:
                start = month_start(today, -2)
                Payment.objects.create(
                    user=user,
                    gym=gym,
                    amount_cents=45000,
                    paid_on=start,
                    method=Payment.Method.TRANSFER,
                    period_start=start,
                    period_end=month_start(start, 12) - timedelta(days=1),
                    note="Abonnement annuel",
                    recorded_by=coach,
                )
                continue
            last_offset = -1 if p.late else 0
            for k in range(p.paid_months):
                start = month_start(today, last_offset - (p.paid_months - 1 - k))
                Payment.objects.create(
                    user=user,
                    gym=gym,
                    amount_cents=4500,
                    paid_on=start + timedelta(days=self.rng.randint(0, 4)),
                    method=self.rng.choice([Payment.Method.CARD, Payment.Method.CASH, Payment.Method.TRANSFER]),
                    period_start=start,
                    period_end=month_start(start, 1) - timedelta(days=1),
                    recorded_by=coach,
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Démo créée : {len(members)} adhérents, {len(self.exercises)} exercices, {len(templates)} modèles, "
                f"{counts['sessions']} séances, {counts['bookings']} inscriptions, {counts['sets']} séries."
            )
        )
        self.stdout.write(
            f"Code d'invitation {gym.invite_code} — mot de passe commun : {PASSWORD}\n"
            "  coach@demo.fr (coach + admin) · bruno.ferre@demo.fr · adherent1..5@demo.fr"
        )

    # ------------------------------------------------------------------ performances

    def _set_values(self, p: Profile, ex: Exercise, reps, load, duration, distance, progress, set_index, sets):
        """Valeurs réalistes d'une série selon le profil, la progression et la fatigue."""
        noise = self.rng.choice([-1, 0, 0, 1])
        if ex.unit == Exercise.Unit.KG_REPS:
            if load:
                kg = load * p.strength * (1 + 0.012 * progress) + noise * 2.5
                fatigue = 1 if set_index == sets - 1 and self.rng.random() < 0.4 else 0
                return {"reps": max(1, reps - fatigue), "load_kg": round_load(kg)}
            base = reps * p.strength * 0.75  # exercice au poids du corps : on progresse en répétitions
            return {"reps": max(1, round(base + progress * 0.5 + noise - (set_index * 0.7)))}
        if ex.unit == Exercise.Unit.TIME:
            if ex.higher_is_better:  # gainage : on tient plus longtemps
                return {"duration_seconds": max(15, round(duration * p.strength + progress * 4 + noise * 5))}
            # rameur : on va plus vite
            return {"duration_seconds": max(85, round(duration / p.strength - progress * 1.5 + noise * 2 + set_index))}
        return {"distance_m": max(500, round(distance * p.strength + progress * 60 + noise * 50, -1))}

    def _session_sets(self, user, p: Profile, template, day, booking, progress) -> int:
        n = 0
        for item in template.items.select_related("exercise"):
            ex = item.exercise
            load = float(item.target_load_kg) if item.target_load_kg else None
            for i in range(item.sets):
                values = self._set_values(
                    p, ex, item.reps, load, item.target_duration_seconds, item.target_distance_m, progress, i, item.sets
                )
                PerformanceSet.objects.create(
                    user=user,
                    exercise=ex,
                    booking=booking,
                    date=day,
                    set_number=i + 1,
                    recorded_by=user,
                    rpe=Decimal(self.rng.choice(["7", "7.5", "8", "8.5", "9"])) if ex.unit == "kg_reps" else None,
                    **values,
                )
                n += 1
        return n

    def _free_sets(self, user, p: Profile, day, progress) -> int:
        plan = [("Squat", 5, 5, 75), ("Développé couché", 3, 6, 55), ("Gainage", 2, None, None)]
        n = 0
        for name, sets, reps, load in plan:
            ex = self.exercises[name]
            for i in range(sets):
                values = self._set_values(p, ex, reps, load, 60, None, progress, i, sets)
                PerformanceSet.objects.create(
                    user=user, exercise=ex, date=day, set_number=i + 1, recorded_by=user, **values
                )
                n += 1
        return n
