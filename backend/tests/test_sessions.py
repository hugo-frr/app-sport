from datetime import timedelta

import pytest
from django.core import mail
from django.db import IntegrityError
from django.utils import timezone

from apps.classes.models import Booking, Session


def book(c, s):
    return c.post(f"/api/v1/sessions/{s.id}/book")


def test_book_and_cancel(client_for, member, gym, make_session, django_capture_on_commit_callbacks):
    s = make_session(gym, capacity=2)
    c = client_for(member)
    with django_capture_on_commit_callbacks(execute=True):
        r = book(c, s)
    assert r.status_code == 201, r.data
    assert r.data["my_booking"]["status"] == "booked"
    assert r.data["spots_left"] == 1
    assert len(mail.outbox) == 1
    assert book(c, s).status_code == 409  # double inscription

    r = c.post(f"/api/v1/sessions/{s.id}/cancel")
    assert r.status_code == 200
    assert r.data["my_booking"]["status"] == "cancelled"
    assert r.data["spots_left"] == 2
    # réinscription après annulation : même ligne réactivée
    assert book(c, s).status_code == 201
    assert Booking.objects.filter(user=member, session=s).count() == 1


def test_capacity_is_enforced(client_for, make_user, gym, make_session):
    s = make_session(gym, capacity=2)
    users = [make_user(gym) for _ in range(3)]
    codes = [book(client_for(u), s).status_code for u in users]
    assert codes == [201, 201, 409]
    assert s.bookings.filter(status="booked").count() == 2


def test_unique_booking_constraint(member, gym, make_session):
    s = make_session(gym)
    Booking.objects.create(user=member, session=s)
    with pytest.raises(IntegrityError):
        Booking.objects.create(user=member, session=s)


def test_cancellation_deadline(client_for, member, gym, make_session):
    gym.cancellation_deadline_hours = 4
    gym.save()
    s = make_session(gym, hours_from_now=2)
    c = client_for(member)
    assert book(c, s).status_code == 201
    r = c.post(f"/api/v1/sessions/{s.id}/cancel")
    assert r.status_code == 400
    assert "4 h" in str(r.data)


def test_cannot_book_past_or_unpublished(client_for, member, coach, gym, make_session):
    past = make_session(gym, starts_at=timezone.now() - timedelta(hours=1))
    assert book(client_for(member), past).status_code == 400
    done = make_session(gym, status=Session.Status.DONE)
    assert book(client_for(member), done).status_code == 400


def test_suspended_member_cannot_book(client_for, member, coach, gym, make_session):
    s = make_session(gym)
    r = client_for(coach).patch(f"/api/v1/members/{member.id}/membership", {"status": "suspended"})
    assert r.status_code == 200
    member.refresh_from_db()
    assert book(client_for(member), s).status_code in (400, 403)


def test_coach_creates_publishes_and_takes_attendance(client_for, coach, member, other_member, gym, make_exercise):
    ex = make_exercise(gym, name="Squat")
    c = client_for(coach)
    t = c.post(
        "/api/v1/templates",
        {"name": "Jambes", "items": [{"exercise": ex.id, "sets": 4, "reps": 8, "target_load_kg": "60"}]},
        format="json",
    )
    assert t.status_code == 201, t.data
    starts = (timezone.now() + timedelta(days=1)).isoformat()
    r = c.post("/api/v1/sessions", {"title": "Jambes", "starts_at": starts, "capacity": 8, "template": t.data["id"]})
    assert r.status_code == 201, r.data
    sid = r.data["id"]
    assert r.data["status"] == "draft"
    assert client_for(member).get("/api/v1/sessions").data == []
    assert c.patch(f"/api/v1/sessions/{sid}", {"status": "published"}).status_code == 200

    detail = client_for(member).get(f"/api/v1/sessions/{sid}")
    assert detail.data["items"][0]["exercise_name"] == "Squat"
    assert book(client_for(member), Session.objects.get(pk=sid)).status_code == 201
    assert book(client_for(other_member), Session.objects.get(pk=sid)).status_code == 201

    att = c.get(f"/api/v1/sessions/{sid}/attendance")
    assert len(att.data) == 2
    r = c.post(
        f"/api/v1/sessions/{sid}/attendance",
        {"attendees": [{"user": member.id, "present": True}], "close": True},
        format="json",
    )
    assert r.status_code == 200
    statuses = {a["user_id"]: a["status"] for a in r.data}
    assert statuses == {member.id: "present", other_member.id: "absent"}
    assert Session.objects.get(pk=sid).status == "done"


def test_walk_in_attendance(client_for, coach, member, gym, make_session):
    s = make_session(gym)
    r = client_for(coach).post(
        f"/api/v1/sessions/{s.id}/attendance", {"attendees": [{"user": member.id, "present": True}]}, format="json"
    )
    assert r.status_code == 200
    assert Booking.objects.get(user=member, session=s).status == "present"


def test_session_filters(client_for, member, gym, make_session):
    today = make_session(gym, hours_from_now=1)
    make_session(gym, hours_from_now=24 * 10)
    c = client_for(member)
    day = timezone.localtime(today.starts_at).date().isoformat()
    r = c.get(f"/api/v1/sessions?date={day}")
    assert [s["id"] for s in r.data] == [today.id]
    assert len(c.get("/api/v1/sessions?upcoming=true").data) == 2


def test_booking_history(client_for, member, gym, make_session):
    s = make_session(gym)
    book(client_for(member), s)
    r = client_for(member).get("/api/v1/bookings")
    assert r.status_code == 200 and r.data[0]["session"]["id"] == s.id
