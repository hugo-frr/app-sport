import type { LastSet, PaymentMethod, Unit } from './types';

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en heure locale. */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse 'YYYY-MM-DD' comme date locale (et non UTC). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function formatDay(input: string | Date, long = false): string {
  const d = typeof input === 'string' ? (input.length === 10 ? parseDay(input) : new Date(input)) : input;
  const today = isoDate();
  const key = isoDate(d);
  if (key === today) return "Aujourd'hui";
  if (key === isoDate(addDays(new Date(), 1))) return 'Demain';
  if (key === isoDate(addDays(new Date(), -1))) return 'Hier';
  const name = long ? DAYS_LONG[d.getDay()] : DAYS[d.getDay()];
  const label = `${name} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const formatDateTime = (iso: string) => `${formatDay(iso)} à ${formatTime(iso)}`;

export function formatShortDate(day: string): string {
  const d = parseDay(day);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function daysAgo(iso: string | null): string {
  if (!iso) return 'Jamais venu';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff <= 0) return "Venu aujourd'hui";
  if (diff === 1) return 'Venu hier';
  return `Venu il y a ${diff} j`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '–';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}:${pad(s)}` : `${s} s`;
}

export function formatDistance(m: number | null | undefined): string {
  if (m == null) return '–';
  return m >= 1000 ? `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} km` : `${m} m`;
}

export function formatKg(kg: number | string | null | undefined): string {
  if (kg == null || kg === '') return '';
  const n = Number(kg);
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} kg`;
}

export const formatEuros = (cents: number) =>
  `${(cents / 100).toFixed(2).replace('.', ',').replace(',00', '')} €`;

/** Une série lisible : "8 × 60 kg", "1:45", "2 km". */
type SetLike = {
  reps?: number | null;
  load_kg?: number | string | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
};

export function formatSet(unit: Unit, s: SetLike): string {
  if (unit === 'time') return formatDuration(s.duration_seconds);
  if (unit === 'distance') return formatDistance(s.distance_m);
  const load = s.load_kg != null && Number(s.load_kg) > 0 ? ` × ${formatKg(s.load_kg)}` : '';
  return `${s.reps ?? '–'} reps${load}`;
}

/**
 * Résumé court d'une séance sur un exercice :
 * "3 × 8 à 60 kg", "4 × 6 jusqu'à 90 kg", "8, 8, 7 reps à 60 kg", "3 × 1:00".
 */
export function summarizeSets(unit: Unit, sets: LastSet[]): string {
  if (!sets.length) return '';
  const labels = sets.map((s) => formatSet(unit, s));
  if (unit !== 'kg_reps') {
    if (labels.every((l) => l === labels[0])) return `${sets.length} × ${labels[0]}`;
    return labels.join(', ');
  }
  const reps = sets.map((s) => s.reps ?? 0);
  const loads = sets.map((s) => Number(s.load_kg ?? 0));
  const sameReps = reps.every((r) => r === reps[0]);
  const sameLoad = loads.every((l) => l === loads[0]);
  const loadText = (kg: number) => (kg > 0 ? formatKg(kg) : '');
  if (sameReps && sameLoad) return `${sets.length} × ${reps[0]}${loads[0] ? ` à ${loadText(loads[0])}` : ''}`;
  if (sameReps) return `${sets.length} × ${reps[0]} jusqu'à ${loadText(Math.max(...loads))}`;
  if (sameLoad) return `${reps.join(', ')} reps${loads[0] ? ` à ${loadText(loads[0])}` : ''}`;
  return `${sets.length} séries jusqu'à ${loadText(Math.max(...loads))}`;
}

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  card: 'CB',
  cash: 'Espèces',
  transfer: 'Virement',
  cheque: 'Chèque',
  other: 'Autre',
};

export const UNIT_LABELS: Record<Unit, string> = {
  kg_reps: 'Charge × reps',
  time: 'Temps',
  distance: 'Distance',
};

export const fullName = (u: { first_name: string; last_name: string; email?: string }) =>
  `${u.first_name} ${u.last_name}`.trim() || u.email || '';

const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** "Vendredi 20 novembre" — pour la ligne au-dessus des grands titres. */
export function formatLongDate(d: Date = new Date()): string {
  const s = `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const initials = (u: { first_name: string; last_name: string }) =>
  `${u.first_name.charAt(0)}${u.last_name.charAt(0)}`.toUpperCase();
