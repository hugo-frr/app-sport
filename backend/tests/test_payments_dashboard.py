from datetime import timedelta

from django.utils import timezone

from apps.classes.models import Booking
from apps.gyms.models import Membership


def pay(c, user, start, end, amount=4500):
    return c.post(
        "/api/v1/payments",
        {
            "user": user.id,
            "amount_cents": amount,
            "paid_on": start.isoformat(),
            "method": "card",
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
        },
    )


def test_payment_status(client_for, coach, member, other_member):
    today = timezone.localdate()
    c = client_for(coach)
    assert pay(c, member, today - timedelta(days=10), today + timedelta(days=20)).status_code == 201
    assert pay(c, other_member, today - timedelta(days=40), today - timedelta(days=10)).status_code == 201
    members = {m["id"]: m for m in c.get("/api/v1/members").data}
    assert members[member.id]["payment_status"] == "up_to_date"
    assert members[other_member.id]["payment_status"] == "late"
    late = c.get("/api/v1/members?payment_status=late").data
    assert [m["id"] for m in late] == [other_member.id]
    assert client_for(member).get("/api/v1/subscription").data["status"] == "up_to_date"
    assert len(client_for(member).get("/api/v1/payments").data) == 1


def test_payment_validation(client_for, coach, member):
    today = timezone.localdate()
    c = client_for(coach)
    assert pay(c, member, today, today - timedelta(days=1)).status_code == 400
    assert pay(c, member, today, today, amount=0).status_code == 400


def test_dashboard(client_for, coach, member, other_member, gym, make_session):
    today = timezone.localdate()
    # member : venu aujourd'hui, à jour ; other_member : inscrit il y a 30 jours, jamais venu, impayé
    Membership.objects.filter(user=other_member).update(joined_at=today - timedelta(days=30))
    Membership.objects.filter(user=member).update(joined_at=today - timedelta(days=30))
    s = make_session(gym, starts_at=timezone.now().replace(hour=12, minute=0))
    Booking.objects.create(user=member, session=s, status=Booking.Status.PRESENT)
    pay(client_for(coach), member, today, today + timedelta(days=30))

    r = client_for(coach).get("/api/v1/dashboard")
    assert r.status_code == 200
    assert r.data["week"]["total_present"] == 1
    assert [m["id"] for m in r.data["inactive_members"]] == [other_member.id]
    assert [m["id"] for m in r.data["unpaid_members"]] == [other_member.id]
    assert r.data["today_sessions"][0]["present"] == 1


def test_member_summary(client_for, coach, member, gym, make_session):
    s = make_session(gym)
    Booking.objects.create(user=member, session=s, status=Booking.Status.PRESENT)
    r = client_for(coach).get(f"/api/v1/members/{member.id}/summary")
    assert r.status_code == 200
    assert r.data["member"]["last_visit"] is not None
    assert r.data["recent_bookings"][0]["session"]["id"] == s.id
