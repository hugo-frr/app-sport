"""Surbooking : 10 inscriptions simultanées sur une séance à 3 places (Postgres uniquement)."""

import threading

import pytest
from django.db import connection, connections

from apps.classes import services
from apps.classes.models import Booking

pytestmark = pytest.mark.skipif(connection.vendor != "postgresql", reason="verrous de ligne : Postgres requis")


@pytest.mark.django_db(transaction=True)
def test_no_overbooking_under_concurrency(make_user, gym, make_session):
    session = make_session(gym, capacity=3)
    users = [make_user(gym) for _ in range(10)]
    barrier = threading.Barrier(len(users))
    results = []

    def attempt(user):
        barrier.wait()
        try:
            services.book_session(user, session.pk)
            results.append("ok")
        except services.Conflict:
            results.append("full")
        finally:
            connections.close_all()

    threads = [threading.Thread(target=attempt, args=(u,)) for u in users]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results.count("ok") == 3
    assert Booking.objects.filter(session=session, status="booked").count() == 3
