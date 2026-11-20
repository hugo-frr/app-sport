from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.gyms.models import Membership

URL = "/api/v1/auth/"


def register(**data):
    payload = {"email": "Alice@Test.fr", "password": "motdepasse-solide-42", "first_name": "Alice", "last_name": "M"}
    payload.update(data)
    return APIClient().post(URL + "register", payload, format="json")


def test_register_member_with_invite_code(gym):
    r = register(invite_code=gym.invite_code.lower())
    assert r.status_code == 201, r.data
    user = User.objects.get(email="alice@test.fr")
    assert user.role == "member"
    assert Membership.objects.filter(user=user, gym=gym).exists()
    assert r.data["access"] and r.data["refresh"]
    assert "invite_code" not in r.data["user"]["gym"]


def test_register_coach_creates_gym(db):
    r = register(gym_name="Ma salle")
    assert r.status_code == 201, r.data
    assert r.data["user"]["role"] == "coach"
    assert r.data["user"]["gym"]["name"] == "Ma salle"
    assert r.data["user"]["gym"]["invite_code"]


def test_register_rejects_bad_code_and_duplicate(gym):
    assert register(invite_code="NOPE").status_code == 400
    assert register().status_code == 201
    assert register(email="alice@test.fr").status_code == 400


def test_login_is_case_insensitive_and_me(member):
    r = APIClient().post(URL + "token", {"email": member.email.upper(), "password": "motdepasse-solide-42"})
    assert r.status_code == 200
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    me = c.get(URL + "me")
    assert me.status_code == 200 and me.data["email"] == member.email


def test_anonymous_is_rejected(db):
    assert APIClient().get("/api/v1/sessions").status_code == 401


def test_join_gym(make_user, gym):
    user = make_user()
    c = APIClient()
    c.force_authenticate(user)
    assert c.get("/api/v1/sessions").status_code == 403  # pas encore de salle
    r = c.post("/api/v1/gyms/join", {"code": gym.invite_code})
    assert r.status_code == 201
    assert c.get("/api/v1/sessions").status_code == 200


def test_delete_account_requires_password(client_for, member):
    c = client_for(member)
    assert c.delete(URL + "me", {"password": "faux"}, format="json").status_code == 400
    assert c.delete(URL + "me", {"password": "motdepasse-solide-42"}, format="json").status_code == 204
    assert not User.objects.filter(pk=member.pk).exists()


def test_export(client_for, member):
    r = client_for(member).get(URL + "me/export")
    assert r.status_code == 200
    assert set(r.data) == {"profile", "memberships", "bookings", "performances", "payments"}
