"""Résolution de la salle courante et permissions partagées.

Règle : chaque queryset est filtré par la salle de l'utilisateur connecté.
Un id hors de la salle renvoie 404 (pas 403) pour ne pas révéler son existence.
"""

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from apps.gyms.models import Gym, Membership


def get_current_gym(user) -> Gym | None:
    """V1 : un utilisateur appartient à une seule salle active."""
    if not user or not user.is_authenticated:
        return None
    cached = getattr(user, "_current_gym", False)
    if cached is not False:
        return cached
    membership = (
        Membership.objects.select_related("gym")
        .filter(user=user, status=Membership.Status.ACTIVE)
        .order_by("id")
        .first()
    )
    user._current_gym = membership.gym if membership else None
    return user._current_gym


def clear_gym_cache(user) -> None:
    user.__dict__.pop("_current_gym", None)


def require_gym(user) -> Gym:
    gym = get_current_gym(user)
    if gym is None:
        raise PermissionDenied("Vous devez d'abord rejoindre une salle.")
    return gym


def get_gym_member_or_404(gym: Gym, user_id):
    """Un utilisateur (coach ou adhérent) appartenant à la salle, sinon 404."""
    from apps.accounts.models import User

    return get_object_or_404(User, pk=user_id, memberships__gym=gym)


def resolve_member(request, member_id):
    """Pour /members/{id}/… : 'me' ou un id. L'adhérent n'accède qu'à lui-même ; le coach à sa salle."""
    gym = require_gym(request.user)
    if member_id == "me" or str(member_id) == str(request.user.pk):
        return request.user, gym
    if not request.user.is_coach:
        # IsSelfOrCoach : un adhérent ne peut pas lire les données d'un autre
        raise PermissionDenied("Accès réservé au coach.")
    return get_gym_member_or_404(gym, member_id), gym


class HasGym(permissions.BasePermission):
    message = "Vous devez d'abord rejoindre une salle."

    def has_permission(self, request, view):
        return get_current_gym(request.user) is not None


class IsCoachOfGym(permissions.BasePermission):
    message = "Accès réservé au coach de la salle."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_coach and get_current_gym(request.user))

    def has_object_permission(self, request, view, obj):
        gym = getattr(obj, "gym", None)
        return gym is None or gym == get_current_gym(request.user)


class CoachWriteMemberRead(permissions.BasePermission):
    """Lecture : tous les membres de la salle ; écriture : coach."""

    message = "Seul le coach peut modifier ces données."

    def has_permission(self, request, view):
        if get_current_gym(request.user) is None:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_coach


class IsSelfOrCoach(permissions.BasePermission):
    """Objet appartenant à l'utilisateur, ou coach de la même salle."""

    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, "user", obj)
        if owner == request.user:
            return True
        return request.user.is_coach and getattr(obj, "gym", None) in (None, get_current_gym(request.user))


class GymScopedMixin:
    """Pour les ViewSets : injecte la salle dans le contexte et gère la génération du schéma OpenAPI."""

    def is_schema_generation(self) -> bool:
        return getattr(self, "swagger_fake_view", False)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if not self.is_schema_generation() and self.request.user.is_authenticated:
            ctx["gym"] = require_gym(self.request.user)
        return ctx
