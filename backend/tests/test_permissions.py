"""La faille la plus courante : lire les données d'un autre en changeant un id dans l'URL."""

from datetime import date

from apps.payments.models import Payment
from apps.performances.models import PerformanceSet


def test_member_cannot_read_other_member_progress(client_for, member, other_member, gym, make_exercise):
    ex = make_exercise(gym)
    PerformanceSet.objects.create(user=other_member, exercise=ex, date=date.today(), reps=5, load_kg=100)
    c = client_for(member)
    assert c.get(f"/api/v1/members/{other_member.id}/progress?exercise={ex.id}").status_code == 403
    assert c.get(f"/api/v1/members/{other_member.id}/progress").status_code == 403
    assert c.get(f"/api/v1/performances/last?exercise={ex.id}&user={other_member.id}").status_code == 403
    assert c.get("/api/v1/members/me/progress").status_code == 200


def test_member_only_lists_own_performances(client_for, member, other_member, gym, make_exercise):
    ex = make_exercise(gym)
    mine = PerformanceSet.objects.create(user=member, exercise=ex, date=date.today(), reps=5, load_kg=50)
    theirs = PerformanceSet.objects.create(user=other_member, exercise=ex, date=date.today(), reps=5, load_kg=80)
    c = client_for(member)
    ids = [p["id"] for p in c.get("/api/v1/performances").data]
    assert ids == [mine.id]
    assert c.get(f"/api/v1/performances/{theirs.id}").status_code == 404
    assert c.patch(f"/api/v1/performances/{theirs.id}", {"reps": 1}).status_code == 404
    assert c.delete(f"/api/v1/performances/{theirs.id}").status_code == 404
    # ?user= ne permet pas de contourner le filtrage
    assert c.get(f"/api/v1/performances?user={other_member.id}").data == []


def test_member_cannot_record_for_someone_else(client_for, member, other_member, gym, make_exercise):
    ex = make_exercise(gym)
    r = client_for(member).post(
        "/api/v1/performances", {"exercise": ex.id, "reps": 5, "load_kg": "40", "user": other_member.id}
    )
    assert r.status_code == 201
    assert r.data["user"] == member.id


def test_member_payments_are_private(client_for, member, other_member, gym, coach):
    p = Payment.objects.create(
        user=other_member,
        gym=gym,
        amount_cents=4000,
        paid_on=date.today(),
        period_start=date.today(),
        period_end=date.today(),
        recorded_by=coach,
    )
    c = client_for(member)
    assert c.get("/api/v1/payments").data == []
    assert c.get(f"/api/v1/payments/{p.id}").status_code == 404
    assert c.post("/api/v1/payments", {}).status_code == 403


def test_member_cannot_write_coach_resources(client_for, member, gym, make_session):
    c = client_for(member)
    assert c.post("/api/v1/exercises", {"name": "Squat"}).status_code == 403
    assert c.get("/api/v1/exercises").status_code == 200
    assert c.get("/api/v1/templates").status_code == 403
    assert c.post("/api/v1/sessions", {}).status_code == 403
    assert c.get("/api/v1/members").status_code == 403
    assert c.get("/api/v1/dashboard").status_code == 403
    s = make_session(gym)
    assert c.get(f"/api/v1/sessions/{s.id}/attendance").status_code == 403


def test_member_does_not_see_drafts(client_for, member, gym, make_session):
    draft = make_session(gym, status="draft")
    c = client_for(member)
    assert c.get("/api/v1/sessions").data == []
    assert c.get(f"/api/v1/sessions/{draft.id}").status_code == 404
    assert c.post(f"/api/v1/sessions/{draft.id}/book").status_code == 404


def test_gyms_are_isolated(client_for, make_gym, make_user, make_session, make_exercise, gym, coach, member):
    other_gym = make_gym("Concurrente")
    other_coach = make_user(other_gym, role="coach")
    stranger = make_user(other_gym)
    s = make_session(other_gym)
    ex = make_exercise(other_gym)

    c = client_for(coach)
    assert c.get(f"/api/v1/sessions/{s.id}").status_code == 404
    assert c.get(f"/api/v1/exercises/{ex.id}").status_code == 404
    assert c.get(f"/api/v1/members/{stranger.id}/summary").status_code == 404
    assert c.get(f"/api/v1/members/{stranger.id}/progress").status_code == 404
    assert [m["id"] for m in c.get("/api/v1/members").data] == [member.id]
    # le coach ne peut pas saisir un paiement / une perf pour un membre d'une autre salle
    r = c.post(
        "/api/v1/payments",
        {
            "user": stranger.id,
            "amount_cents": 100,
            "paid_on": "2026-01-01",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
        },
    )
    assert r.status_code == 400
    mine = make_exercise(gym)
    assert c.post("/api/v1/performances", {"user": stranger.id, "exercise": mine.id, "reps": 3}).status_code == 400
    assert c.post("/api/v1/performances", {"user": member.id, "exercise": ex.id, "reps": 3}).status_code == 400
    # attendance : on ne peut pas pointer un inconnu
    own = make_session(gym)
    r = c.post(
        f"/api/v1/sessions/{own.id}/attendance", {"attendees": [{"user": stranger.id, "present": True}]}, format="json"
    )
    assert r.status_code == 400
    assert client_for(other_coach).get(f"/api/v1/sessions/{own.id}").status_code == 404


def test_template_cannot_use_foreign_exercise(client_for, coach, make_gym, make_exercise):
    foreign = make_exercise(make_gym("Autre"))
    r = client_for(coach).post(
        "/api/v1/templates", {"name": "WOD", "items": [{"exercise": foreign.id, "sets": 3, "reps": 10}]}, format="json"
    )
    assert r.status_code == 400
