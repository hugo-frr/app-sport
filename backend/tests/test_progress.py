from datetime import date
from decimal import Decimal

from apps.exercises.models import Exercise
from apps.performances.models import PerformanceSet
from apps.performances.services import epley_1rm


def add(user, ex, d, *sets):
    for i, (reps, load) in enumerate(sets, 1):
        PerformanceSet.objects.create(user=user, exercise=ex, date=d, set_number=i, reps=reps, load_kg=load)


def test_epley():
    assert epley_1rm(Decimal("100"), 10) == Decimal("133.3")
    assert epley_1rm(Decimal("100"), 1) == Decimal("100")
    assert epley_1rm(None, 5) is None


def test_progress_aggregates(client_for, member, gym, make_exercise):
    ex = make_exercise(gym)
    add(member, ex, date(2026, 10, 1), (8, 60), (8, 60), (6, 65))
    add(member, ex, date(2026, 10, 8), (5, 70), (5, 70))
    r = client_for(member).get(f"/api/v1/members/me/progress?exercise={ex.id}")
    assert r.status_code == 200
    p1, p2 = r.data["points"]
    assert p1 == {
        "date": "2026-10-01",
        "max_load": 65.0,
        "volume": 8 * 60 * 2 + 6 * 65,
        "estimated_1rm": 78.0,
        "total_reps": 22,
        "max_reps": 8,
        "best_duration": None,
        "max_distance": None,
        "total_distance": None,
    }
    assert p2["max_load"] == 70.0 and p2["volume"] == 700.0
    rec = r.data["records"]
    assert rec["max_load"] == {"value": 70.0, "date": "2026-10-08"}
    assert rec["max_volume"] == {"value": 1350.0, "date": "2026-10-01"}
    assert rec["estimated_1rm"]["value"] == 81.7
    assert r.data["last"]["date"] == "2026-10-08"
    assert [s["load_kg"] for s in r.data["last"]["sets"]] == [70.0, 70.0]

    overview = client_for(member).get("/api/v1/members/me/progress").data["exercises"]
    assert overview[0]["exercise"] == ex.id and overview[0]["sessions_count"] == 2


def test_record_detection_on_create(client_for, member, gym, make_exercise):
    ex = make_exercise(gym)
    c = client_for(member)
    first = c.post("/api/v1/performances", {"exercise": ex.id, "reps": 5, "load_kg": "60", "date": "2026-10-01"})
    assert first.status_code == 201, first.data
    assert first.data["record"] is None  # pas de record sur la toute première série
    same = c.post("/api/v1/performances", {"exercise": ex.id, "reps": 5, "load_kg": "60"})
    assert same.data["record"] is None
    better = c.post("/api/v1/performances", {"exercise": ex.id, "reps": 3, "load_kg": "62.5"})
    assert better.data["record"] == {"metric": "load_kg", "value": 62.5, "previous": 60.0}


def test_bodyweight_record_uses_reps(client_for, member, gym, make_exercise):
    ex = make_exercise(gym, name="Tractions")
    c = client_for(member)
    c.post("/api/v1/performances", {"exercise": ex.id, "reps": 8})
    r = c.post("/api/v1/performances", {"exercise": ex.id, "reps": 10})
    assert r.data["record"] == {"metric": "reps", "value": 10.0, "previous": 8.0}


def test_time_record_lower_is_better(client_for, member, gym, make_exercise):
    ex = make_exercise(gym, name="500m rameur", unit=Exercise.Unit.TIME, higher_is_better=False)
    c = client_for(member)
    c.post("/api/v1/performances", {"exercise": ex.id, "duration_seconds": 100})
    assert c.post("/api/v1/performances", {"exercise": ex.id, "duration_seconds": 105}).data["record"] is None
    r = c.post("/api/v1/performances", {"exercise": ex.id, "duration_seconds": 95})
    assert r.data["record"]["metric"] == "duration_seconds"
    prog = c.get(f"/api/v1/members/me/progress?exercise={ex.id}").data
    assert prog["records"]["best_duration"]["value"] == 95


def test_unit_validation(client_for, member, gym, make_exercise):
    c = client_for(member)
    assert c.post("/api/v1/performances", {"exercise": make_exercise(gym).id, "load_kg": "50"}).status_code == 400
    timed = make_exercise(gym, unit=Exercise.Unit.TIME)
    assert c.post("/api/v1/performances", {"exercise": timed.id, "reps": 5}).status_code == 400
    dist = make_exercise(gym, unit=Exercise.Unit.DISTANCE)
    assert c.post("/api/v1/performances", {"exercise": dist.id, "distance_m": 1000}).status_code == 201


def test_performance_linked_to_booking(client_for, member, other_member, gym, make_session, make_exercise):
    s = make_session(gym)
    ex = make_exercise(gym)
    c = client_for(member)
    booking_id = c.post(f"/api/v1/sessions/{s.id}/book").data["my_booking"]["id"]
    r = c.post("/api/v1/performances", {"exercise": ex.id, "reps": 5, "load_kg": "40", "booking": booking_id})
    assert r.status_code == 201
    # la booking d'un autre est refusée
    other_booking = client_for(other_member).post(f"/api/v1/sessions/{s.id}/book").data["my_booking"]["id"]
    r = c.post("/api/v1/performances", {"exercise": ex.id, "reps": 5, "load_kg": "40", "booking": other_booking})
    assert r.status_code == 400


def test_coach_records_for_member_and_last(client_for, coach, member, gym, make_exercise):
    ex = make_exercise(gym)
    c = client_for(coach)
    r = c.post(
        "/api/v1/performances", {"user": member.id, "exercise": ex.id, "reps": 8, "load_kg": "50", "date": "2026-11-01"}
    )
    assert r.status_code == 201 and r.data["user"] == member.id and r.data["recorded_by"] == coach.id
    last = client_for(member).get(f"/api/v1/performances/last?exercise={ex.id}")
    assert last.data[str(ex.id)]["sets"][0]["reps"] == 8
    assert c.get(f"/api/v1/members/{member.id}/progress?exercise={ex.id}").status_code == 200
    none_before = client_for(member).get(f"/api/v1/performances/last?exercise={ex.id}&before=2026-11-01")
    assert none_before.data[str(ex.id)] is None
