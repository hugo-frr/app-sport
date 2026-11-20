# App Sport — suivi coachs & adhérents (V1)

Monorepo :

- `backend/` : API Django 5 + DRF + PostgreSQL, auth JWT, Swagger, admin Django (le back-office du coach).
- `mobile/` : app Expo (React Native, TypeScript) avec Expo Router et TanStack Query. Deux jeux d'onglets selon le rôle.

Le guide de conception est dans [Guide A à Z — App de suivi coachs & adhérents.md](./Guide%20A%20%C3%A0%20Z%20%E2%80%94%20App%20de%20suivi%20coachs%20%26%20adh%C3%A9rents.md).

## Démarrage rapide

### Backend

```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py seed_demo          # salle de démo + historique
python manage.py createsuperuser    # facultatif : accès /admin
python manage.py runserver 0.0.0.0:8000
```

Sans `DATABASE_URL`, l'API utilise SQLite. Pour Postgres :

```bash
docker compose up -d db
export DATABASE_URL=postgres://appsport:appsport@localhost:5433/appsport
```

`docker compose up` lance aussi l'API sur le port 8000.

- Swagger : http://localhost:8000/api/docs/
- Admin coach : http://localhost:8000/admin/ (le coach de démo y a accès)
- Comptes de démo (mot de passe commun `demo-sport-2026`, code d'invitation `DEMO2026`) :

  | Compte | Rôle | Profil des données |
  | --- | --- | --- |
  | `coach@demo.fr` (Camille Coach) | Coach + admin | Crée les exercices, les modèles et le planning |
  | `bruno.ferre@demo.fr` (Bruno Ferré) | Adhérent | Le plus fort et assidu, à jour, inscrit aux séances du jour et aux suivantes |
  | `adherent1@demo.fr` (Léa Martin) | Adhérente | Débutante, assidue, à jour |
  | `adherent2@demo.fr` (Hugo Bernard) | Adhérent | Niveau moyen, à jour |
  | `adherent3@demo.fr` (Inès Petit) | Adhérente | Très assidue, abonnement annuel |
  | `adherent4@demo.fr` (Nathan Durand) | Adhérent | Vient peu, **paiement en retard** |
  | `adherent5@demo.fr` (Chloé Leroy) | Adhérente | **Inactive** depuis 4 semaines, en retard |

  Données générées : 11 exercices (charge, poids du corps, temps, distance), 3 modèles, 8 semaines d'historique (3 séances par semaine) avec une progression réaliste, des entraînements libres, 2 semaines de planning (au-delà de 7 jours en brouillon) et des paiements. `python manage.py seed_demo --reset` régénère tout.

### Mobile

React Native 0.88 demande **Node ≥ 22.13** (`nvm use`, voir `.nvmrc`).

```bash
cd mobile
nvm use
npm install
npx expo start      # QR code → Expo Go sur le téléphone
```

En dev, l'app appelle `http://<machine Metro>:8000`, donc le téléphone et l'ordinateur doivent être sur le même Wi-Fi et l'API lancée avec `0.0.0.0:8000`. Pour une autre URL : `EXPO_PUBLIC_API_URL=http://… npx expo start`.

## Tests et qualité

```bash
cd backend && ruff check . && pytest                                   # SQLite
DATABASE_URL=postgres:///appsport pytest                               # + test de concurrence (surbooking)
cd mobile && npx tsc --noEmit && npx expo lint
```

La CI GitHub Actions (`.github/workflows/ci.yml`) lance lint, migrations, schéma OpenAPI et tests sur Postgres, puis le typecheck et le lint du mobile.

## Règles métier retenues (V1)

| Question du guide | Choix V1 |
| --- | --- |
| Qui saisit les performances ? | **Les deux.** L'adhérent saisit les siennes ; le coach peut saisir pour n'importe quel adhérent de sa salle (bouton « Perfs » pendant l'appel). |
| Séance collective ou individuelle ? | **Les deux** (`kind` : `group` / `individual`, capacité 1). L'entraînement libre, sans séance, est aussi possible. |
| Paiement à la séance, au carnet, mensuel ? | **Par période couverte** (`period_start` → `period_end`) : 1 mois, 3 mois, 1 an ou période libre (carnet). Un adhérent est « à jour » si une période payée couvre aujourd'hui. |

Autres choix :

- Un coach crée sa salle à l'inscription. Un adhérent la rejoint avec le code ou le lien d'invitation (`appsport://register?code=…`).
- Une seule salle par utilisateur en V1. Un id hors de sa salle renvoie 404.
- Désinscription possible jusqu'à X heures avant la séance (réglable par salle, 2 h par défaut).
- Un record est signalé quand une série dépasse strictement le meilleur historique : la charge, ou les reps au poids du corps, ou le temps (plus court ou plus long selon l'exercice), ou la distance. Rien n'est signalé sur la toute première série.
- 1RM estimé : formule d'Epley, et une série à 1 rep vaut sa charge.
- Inactif = aucune présence (ni inscription à la salle) depuis 15 jours (`INACTIVE_DAYS`).

## API (`/api/v1/`)

| Endpoint | Rôle |
| --- | --- |
| `auth/register`, `auth/token`, `auth/token/refresh` | Inscription (adhérent + code, ou coach + nom de salle), JWT. Limitation de débit. |
| `auth/me` (GET/PATCH/DELETE), `auth/me/password`, `auth/me/export` | Profil, suppression de compte et export (RGPD) |
| `gyms/join`, `gyms/mine`, `gyms/mine/regenerate-code` | Rejoindre une salle, paramètres de la salle |
| `exercises` | Lecture : membres. Écriture : coach |
| `templates` | Modèles de séance avec exercices ordonnés et cibles (coach) |
| `sessions` (+ `/book`, `/cancel`, `/attendance`) | Planning, inscription avec verrou de capacité, appel |
| `bookings` | Historique des présences |
| `performances`, `performances/last` | Séries réalisées (renvoient `record` à la création), « la dernière fois » |
| `members`, `members/{id}/summary`, `members/{id}/membership` | Liste coach, fiche adhérent, suspension |
| `members/{id\|me}/progress[?exercise=]` | Charge max, volume, 1RM, records par jour |
| `payments`, `subscription` | Paiements saisis par le coach, état d'abonnement de l'adhérent |
| `dashboard` | Présences de la semaine, inactifs, impayés, séances du jour |

## Écrans mobiles

- **Adhérent** : Planning (places restantes, inscription), Ma séance (cibles, « la dernière fois », saisie avec boutons +/− pré-remplie, toast « Nouveau record ! »), Progression (courbes et records), Profil (abonnement, présences, export, suppression du compte, confidentialité).
- **Coach** : Aujourd'hui (séances du jour avec appel en un tap, semaine, inactifs, impayés), Séances (planning, brouillons, modèles), Adhérents (dernière venue, paiement, fiche, saisie de paiement), Exercices (bibliothèque), Profil (code et lien d'invitation).

## Déploiement

- `backend/Dockerfile` : gunicorn, avec les migrations au démarrage. Variables : voir `backend/.env.example` (`DJANGO_DEBUG=false`, `DJANGO_SECRET_KEY`, `DATABASE_URL`, `SENTRY_DSN`, SMTP…).
- Mobile : `mobile/eas.json` contient les profils `development`, `preview` (staging) et `production`. Remplacez les URLs `example.com`, puis `npx eas-cli@latest build --profile preview`.

## Hors V1 (voir le guide)

Stripe, notifications push, liste d'attente, multi-salles, mode hors ligne et chrono, assistant IA.
