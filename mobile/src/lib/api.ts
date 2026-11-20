import Constants from 'expo-constants';

import { secureStorage } from './storage';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // En dev : même machine que le serveur Metro (fonctionne sur téléphone via Expo Go)
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:8000`;
}

export const API_BASE = resolveBaseUrl();
const API = `${API_BASE}/api/v1`;
const REFRESH_KEY = 'appsport.refresh';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

/** Transforme les erreurs DRF ({detail}, {champ: [msg]}, [msg]) en une phrase lisible. */
function errorMessage(data: unknown, status: number): string {
  if (!data) return `Erreur ${status}`;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map((d) => errorMessage(d, status)).join('\n');
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.detail === 'string') return obj.detail;
    return Object.entries(obj)
      .map(([k, v]) => {
        const msg = errorMessage(v, status);
        return k === 'non_field_errors' ? msg : `${FIELD_LABELS[k] ?? k} : ${msg}`;
      })
      .join('\n');
  }
  return `Erreur ${status}`;
}

const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  password: 'Mot de passe',
  invite_code: "Code d'invitation",
  reps: 'Répétitions',
  load_kg: 'Charge',
  duration_seconds: 'Temps',
  distance_m: 'Distance',
  starts_at: 'Début',
  name: 'Nom',
  amount_cents: 'Montant',
  period_end: 'Fin de période',
};

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export const tokens = {
  async set(access: string, refresh: string) {
    accessToken = access;
    await secureStorage.set(REFRESH_KEY, refresh);
  },
  async clear() {
    accessToken = null;
    await secureStorage.remove(REFRESH_KEY);
  },
  hasAccess: () => !!accessToken,
  onExpired(cb: () => void) {
    onSessionExpired = cb;
  },
};

/** Renouvelle l'access token avec le refresh token (une seule requête à la fois). */
export async function refreshAccess(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = await secureStorage.get(REFRESH_KEY);
      if (!refresh) return false;
      try {
        const res = await fetch(`${API}/auth/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        await tokens.set(data.access, data.refresh ?? refresh);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown, retry = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur. Vérifiez votre connexion.');
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/token')) {
    if (await refreshAccess()) return request<T>(method, path, body, false);
    await tokens.clear();
    onSessionExpired?.();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, errorMessage(data, res.status), data);
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
