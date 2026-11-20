# Guide A à Z — App de suivi coachs & adhérents

Nov 20, 2026 · @Hugo

## 1. Vision et périmètre

L'app sert deux rôles sur une seule base de données : le **coach** gère le contenu et le suivi de la salle, l'**adhérent** consulte, s'inscrit et suit sa progression. Le cœur du produit, c'est la progression : tout le reste (séances, présences, paiements) alimente cet historique.

Règle d'or : livrer un MVP utilisable par une seule salle en 8 à 10 semaines, puis itérer avec de vrais utilisateurs. Trouve une salle pilote (ton club, un coach que tu connais) avant d'écrire une ligne de code.

| Fonction | MVP (v1) | Plus tard (v2+) |
| --- | --- | --- |
| Comptes coach / adhérent, invitation par lien | Oui | Multi-salles, multi-coachs avec rôles fins |
| Bibliothèque d'exercices (nom, groupe musculaire, type de mesure, vidéo) | Oui | Bibliothèque partagée entre coachs |
| Création de séances (liste d'exercices + séries/reps/charge cibles) | Oui | Programmes sur plusieurs semaines |
| Planning de séances et inscription | Oui | Liste d'attente, rappels push |
| Présences (qui est venu, quelle séance) | Oui | Check-in par QR code |
| Saisie des performances (charge, reps, temps) | Oui | Saisie hors-ligne, chrono intégré |
| Graphiques de progression et records | Oui | 1RM estimé, comparaison, objectifs |
| Suivi des paiements (saisie manuelle par le coach) | Oui | Paiement en ligne Stripe, abonnements |
| Notifications | Email simple | Push mobile, messagerie coach-adhérent |
| Assistant IA (suggestion de charge, résumé de progression) | Non | Oui |

## 2. Spécifications fonctionnelles

Écris ces user stories avant de coder : chacune devient un ticket, et sa phrase "pour…" te dit quand elle est finie. Valide-les avec ta salle pilote.

**Côté coach**

1. Je crée un exercice (nom, catégorie, unité de mesure : kg/reps, temps, distance) pour le réutiliser dans mes séances.
2. Je compose un modèle de séance (exercices ordonnés, séries, reps et charges cibles) pour ne pas tout réécrire.
3. Je planifie une séance à une date et heure, avec une capacité maximale, et je la publie à l'avance.
4. Je vois qui est inscrit et je coche les présents le jour J.
5. Sur la fiche d'un adhérent, je vois sa dernière venue, ses dernières séances et ses performances.
6. J'enregistre un paiement (montant, date, moyen, période couverte) et je vois qui est à jour ou en retard.
7. J'ai un tableau de bord : présences de la semaine, adhérents inactifs depuis 15 jours, impayés.

**Côté adhérent**

1. Je rejoins la salle via un lien d'invitation ou un code.
2. Je vois les séances publiées et je m'inscris ou me désinscris (jusqu'à X heures avant).
3. Pendant ou après la séance, je saisis mes performances réelles par exercice (ou le coach le fait pour moi).
4. Je vois ma progression par exercice : courbe de la charge max, du volume (séries × reps × charge) et mes records personnels.
5. Je vois mon historique de présences et l'état de mon abonnement.

**Règles métier à trancher tôt**

- Qui saisit les performances : l'adhérent, le coach, ou les deux ?
- Une séance est-elle collective (cours) ou individuelle (programme perso) ? Le modèle doit gérer les deux.
- Le paiement est-il à la séance, au carnet ou mensuel ?

## 3. Choix techniques

Recommandation : un backend **Django + Django REST Framework + PostgreSQL** (que tu maîtrises déjà), et une app mobile **React Native avec Expo** pour iOS et Android à partir d'un seul code. L'adhérent est sur son téléphone à la salle : le mobile d'abord est le bon choix.

| Brique | Choix | Pourquoi |
| --- | --- | --- |
| Backend / API | Django 5 + DRF | Admin Django gratuit (back-office du coach dès le jour 1), ORM, auth, migrations |
| Base de données | PostgreSQL | Relations fortes, requêtes d'agrégation pour la progression |
| Auth | JWT (djangorestframework-simplejwt) | Standard pour une app mobile |
| App mobile | React Native + Expo (TypeScript) | Un code pour iOS/Android, build cloud avec EAS, pas besoin de Mac |
| Navigation / données | Expo Router + TanStack Query | Cache, rechargement, états de chargement gérés |
| Graphiques | Victory Native ou react-native-gifted-charts | Courbes de progression |
| Tâches de fond | Celery + Redis (v2) | Rappels, emails, résumés IA |
| Hébergement | Railway, Render ou Scaleway (Docker) | Déploiement simple, base gérée, hébergement UE possible |
| Stockage médias | S3 compatible (Scaleway, Cloudflare R2) | Vidéos et images d'exercices |

&#91;embedded content: architecture · 5 briques\]

Toute la logique métier (droits, capacité, calculs de progression) vit dans l'API : l'app mobile et l'admin ne font qu'afficher et saisir.

Alternatives : **FastAPI** si tu veux plus de contrôle (mais tu perds l'admin), **Supabase** si tu veux aller très vite sans backend maison (mais logique métier moins maîtrisée), **Flutter** à la place de React Native si tu préfères Dart.

Organisation du code : un monorepo avec `backend/` (projet Django, apps `accounts`, `gyms`, `exercises`, `classes`, `performances`, `payments`) et `mobile/` (projet Expo), plus un `docker-compose.yml` pour lancer Postgres et l'API en local.

## 4. Modèle de données

Le point clé : séparer le **prévu** (modèle de séance, cibles) du **réalisé** (performances saisies). La progression se calcule uniquement sur le réalisé, série par série.

| Entité | Champs principaux | Relations |
| --- | --- | --- |
| User | email, nom, rôle (coach / member), téléphone | — |
| Gym | nom, adresse, code d'invitation | coachs et membres via Membership |
| Membership | statut (actif, suspendu), date d'entrée | User ↔ Gym |
| Exercise | nom, catégorie, unité (kg\_reps, time, distance), vidéo, description | créé par un coach, rattaché à une Gym |
| WorkoutTemplate | nom, description | créé par un coach |
| TemplateItem | ordre, séries, reps, charge cible, repos | Template → Exercise |
| Session | date/heure, durée, capacité, statut (brouillon, publiée, terminée) | Gym, Template, coach |
| Booking | statut (inscrit, annulé, présent, absent), date d'inscription | User ↔ Session (unique) |
| PerformanceSet | numéro de série, reps, charge, temps, distance, RPE | Booking ou User + Exercise + date |
| Payment | montant (centimes), date, moyen, période début/fin, note | User, Gym, saisi par un coach |

Trois conseils concrets :

- Stocke les montants en **centimes (entier)**, jamais en float.
- Une contrainte d'unicité sur (user, session) dans Booking évite les doubles inscriptions ; vérifie la capacité dans une transaction (`select_for_update`) pour éviter le surbooking.
- Garde PerformanceSet utilisable **sans** séance (entraînement libre) : Booking nullable, user + date obligatoires.

Calculs de progression (côté API, avec l'ORM) :

- Charge max par jour = max(charge) par exercice et par date.
- Volume = somme de (reps × charge) par séance.
- 1RM estimé (formule d'Epley) = charge × (1 + reps / 30).
- Record personnel = le max historique, signalé quand une nouvelle série le dépasse.

## 5. API et permissions

Une API REST versionnée (`/api/v1/`), documentée automatiquement avec **drf-spectacular** (Swagger) : l'app mobile se code ensuite directement contre cette doc.

| Endpoint | Méthodes | Qui |
| --- | --- | --- |
| /auth/register, /auth/token, /auth/token/refresh | POST | Tous |
| /gyms/join | POST (code d'invitation) | Adhérent |
| /exercises | GET, POST, PATCH, DELETE | Lecture : tous ; écriture : coach |
| /templates | GET, POST, PATCH, DELETE | Coach |
| /sessions | GET (filtre date, statut), POST, PATCH | Lecture : membres de la salle ; écriture : coach |
| /sessions/{id}/book, /sessions/{id}/cancel | POST | Adhérent |
| /sessions/{id}/attendance | GET, POST (liste des présents) | Coach |
| /performances | GET, POST | Adhérent (les siennes), coach (sa salle) |
| /members/{id}/progress?exercise=… | GET (séries agrégées pour les graphes) | L'adhérent lui-même, coach |
| /members/{id}/summary | GET (dernière venue, dernières séances, paiements) | Coach |
| /payments | GET, POST | Coach ; adhérent en lecture des siens |
| /dashboard | GET (présences, inactifs, impayés) | Coach |

Permissions : écris des classes DRF `IsCoachOfGym` et `IsSelfOrCoach`, et filtre **toujours** les querysets par la salle de l'utilisateur connecté (`get_queryset`). C'est la faille la plus courante : un adhérent qui lit les données d'un autre en changeant un id dans l'URL. Teste ce cas explicitement.

## 6. Front : écrans coach et adhérent

Une seule app mobile, deux jeux d'onglets selon le rôle après connexion. Pour la v1, le coach peut aussi utiliser l'**admin Django** sur ordinateur pour les tâches lourdes (créer 50 exercices, saisir des paiements) : ça t'évite de coder un back-office tout de suite.

| Rôle | Onglet | Contenu |
| --- | --- | --- |
| Adhérent | Planning | Séances publiées, places restantes, bouton s'inscrire |
| Adhérent | Ma séance | Exercices du jour avec cibles, saisie rapide série par série |
| Adhérent | Progression | Liste d'exercices, courbe charge max / volume / 1RM, records |
| Adhérent | Profil | Historique de présences, abonnement, déconnexion |
| Coach | Aujourd'hui | Séances du jour, appel des présents en un tap |
| Coach | Séances | Modèles et planning, création et publication |
| Coach | Adhérents | Liste avec dernière venue et statut de paiement, fiche détaillée |
| Coach | Exercices | Bibliothèque, ajout et édition |

Conseils UX qui font la différence à la salle :

- La saisie d'une série doit prendre moins de 5 secondes : pré-remplis avec la cible ou la dernière perf, gros boutons +/−.
- Affiche la dernière perf à côté de chaque exercice ("la dernière fois : 3 × 8 à 60 kg") : c'est la fonction que les adhérents utiliseront le plus.
- Un toast "Nouveau record !" quand une série bat le max : c'est ce qui fait revenir.
- Maquette les 8 écrans (Figma ou papier) et fais-les tester à 2-3 personnes avant de coder.

## 7. Paiements, RGPD et sécurité

**Paiements.** En v1, le coach saisit les paiements reçus (espèces, virement, CB sur place) : zéro intégration, zéro risque. En v2, ajoute **Stripe** (Checkout + Billing pour les abonnements, webhooks pour mettre à jour Payment). Une séance en salle est un service physique : sur les stores, elle se paie en principe hors achat intégré Apple/Google, mais relis les règles des stores avant de publier.

**RGPD.** Tu traites des données personnelles, et potentiellement de santé si tu ajoutes poids, blessures ou mensurations.

- Politique de confidentialité et CGU accessibles dans l'app (obligatoire pour les stores aussi).
- Collecte minimale : ne demande pas de données de santé en v1.
- Hébergement dans l'UE, export et suppression du compte depuis l'app.
- Registre des traitements simple ; un contrat de sous-traitance avec la salle si tu leur vends le service.

**Sécurité.**

- HTTPS partout, secrets dans des variables d'environnement, `DEBUG=False` en production.
- Tokens stockés avec `expo-secure-store`, jamais en AsyncStorage.
- Limitation de débit sur l'auth (DRF throttling), mots de passe hachés par Django (par défaut).
- Sauvegardes automatiques quotidiennes de PostgreSQL, et un test de restauration une fois.

## 8. Tests, déploiement, publication

**Tests.** Concentre-toi sur ce qui casse la confiance : pytest + pytest-django sur les permissions (un adhérent ne voit pas les données d'un autre), la capacité des séances, et les calculs de progression. Une CI GitHub Actions lance les tests et le lint (ruff) à chaque push.

**Déploiement du backend.**

1. Dockerfile pour l'API (gunicorn), Postgres géré par l'hébergeur.
2. Deux environnements : `staging` (pour tester avec la salle pilote) et `production`.
3. Migrations lancées automatiquement au déploiement, logs et alertes d'erreurs avec Sentry.

**Distribution de l'app.**

1. Pendant le pilote : Expo Go puis builds internes via EAS (TestFlight sur iOS, test interne sur Google Play).
2. Comptes développeur : Apple (environ 99 USD par an) et Google Play (environ 25 USD une fois) ; vérifie les tarifs actuels.
3. Fiches store : captures d'écran, description, politique de confidentialité, compte de test pour les reviewers Apple.
4. Mises à jour rapides sans repasser par les stores avec EAS Update (pour le JavaScript seulement).

## 9. Roadmap et checklist

Compte environ 10 semaines à temps partiel pour le MVP. Coche au fur et à mesure ; chaque phase se termine par une démo à la salle pilote.

**Semaine 1 — Cadrage**

- [ ] Trouver la salle pilote et 1 coach référent
- [ ] Valider les user stories et trancher les 3 règles métier
- [ ] Maquetter les 8 écrans et les faire tester

**Semaines 2-3 — Backend socle**

- [ ] Monorepo, docker-compose, Django + DRF + Postgres, CI
- [ ] Modèle User custom (à faire avant la première migration), auth JWT
- [ ] Modèles Gym, Membership, Exercise, WorkoutTemplate, Session, Booking
- [ ] Admin Django configuré pour le coach

**Semaines 4-5 — Séances et présences**

- [ ] Endpoints séances, inscription (capacité + transaction), présences
- [ ] App Expo : connexion, onglets par rôle, planning, inscription
- [ ] Coach : appel des présents

**Semaines 6-7 — Performances et progression**

- [ ] Modèle PerformanceSet et saisie rapide dans l'app
- [ ] Endpoint progress (charge max, volume, 1RM, records)
- [ ] Écran Progression avec graphiques, "dernière fois" sur chaque exercice

**Semaine 8 — Paiements et tableau de bord**

- [ ] Payment (saisie coach), statut à jour / en retard
- [ ] Fiche adhérent et dashboard coach

**Semaines 9-10 — Pilote**

- [ ] Déploiement staging + Sentry + sauvegardes
- [ ] Builds TestFlight / test interne, onboarding des adhérents pilotes
- [ ] Politique de confidentialité, suppression de compte
- [ ] Collecter les retours, prioriser la v2 (Stripe, push, IA)

Première action concrète ce week-end : créer le repo, lancer `django-admin startproject` et `npx create-expo-app`, et coder le modèle User custom.
