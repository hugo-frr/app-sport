from datetime import timedelta
from itertools import count

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.classes.models import Session
from apps.exercises.models import Exercise
from apps.gyms.models import Gym, Membership

_seq = count(1)


@pytest.fixture(autouse=True)
def _no_throttle(settings):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_RATES": {"auth": "1000/min", "join": "1000/min"},
    }


@pytest.fixture
def make_gym(db):
    def _make(name="Salle"):
        return Gym.objects.create(name=f"{name} {next(_seq)}")

    return _make


@pytest.fixture
def make_user(db):
    def _make(gym=None, role=User.Role.MEMBER, **kw):
        n = next(_seq)
        user = User.objects.create_user(
            email=kw.pop("email", f"user{n}@test.fr"),
            password=kw.pop("password", "motdepasse-solide-42"),
            first_name=kw.pop("first_name", f"Prénom{n}"),
            last_name=kw.pop("last_name", f"Nom{n}"),
            role=role,
            **kw,
        )
        if gym:
            Membership.objects.create(user=user, gym=gym)
        return user

    return _make


@pytest.fixture
def gym(make_gym):
    return make_gym("Pilote")


@pytest.fixture
def coach(make_user, gym):
    return make_user(gym, role=User.Role.COACH)


@pytest.fixture
def member(make_user, gym):
    return make_user(gym)


@pytest.fixture
def other_member(make_user, gym):
    return make_user(gym)


@pytest.fixture
def client_for():
    def _client(user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    return _client


@pytest.fixture
def make_session(db):
    def _make(gym, coach=None, hours_from_now=48, **kw):
        return Session.objects.create(
            gym=gym,
            coach=coach,
            title=kw.pop("title", "Cross training"),
            starts_at=kw.pop("starts_at", timezone.now() + timedelta(hours=hours_from_now)),
            capacity=kw.pop("capacity", 10),
            status=kw.pop("status", Session.Status.PUBLISHED),
            **kw,
        )

    return _make


@pytest.fixture
def make_exercise(db):
    def _make(gym, name=None, unit=Exercise.Unit.KG_REPS, **kw):
        return Exercise.objects.create(gym=gym, name=name or f"Exo {next(_seq)}", unit=unit, **kw)

    return _make
