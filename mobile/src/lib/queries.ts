import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, qs } from './api';
import type {
  Attendee,
  Booking,
  Dashboard,
  Exercise,
  ExerciseOverview,
  Gym,
  LastPerformance,
  Member,
  MemberSummary,
  Payment,
  PaymentStatus,
  PerformanceSet,
  Progress,
  Session,
  WorkoutTemplate,
} from './types';

export const keys = {
  sessions: (params: object) => ['sessions', params] as const,
  session: (id: number) => ['session', id] as const,
  attendance: (id: number) => ['attendance', id] as const,
  bookings: ['bookings'] as const,
  exercises: ['exercises'] as const,
  templates: ['templates'] as const,
  performances: (params: object) => ['performances', params] as const,
  last: (params: object) => ['last', params] as const,
  progress: (member: string | number, exercise?: number) => ['progress', String(member), exercise ?? null] as const,
  members: (params: object) => ['members', params] as const,
  summary: (id: number) => ['summary', id] as const,
  payments: (params: object) => ['payments', params] as const,
  subscription: ['subscription'] as const,
  dashboard: ['dashboard'] as const,
  gym: ['gym'] as const,
};

// ---- Séances
export type SessionParams = { upcoming?: boolean; date?: string; date_from?: string; date_to?: string; status?: string };

export const useSessions = (params: SessionParams) =>
  useQuery({ queryKey: keys.sessions(params), queryFn: () => api.get<Session[]>(`/sessions${qs(params)}`) });

export const useSession = (id: number | undefined) =>
  useQuery({
    queryKey: keys.session(id ?? 0),
    queryFn: () => api.get<Session>(`/sessions/${id}`),
    enabled: !!id,
  });

function useInvalidate() {
  const qc = useQueryClient();
  return (...prefixes: string[]) =>
    Promise.all(prefixes.map((p) => qc.invalidateQueries({ queryKey: [p] })));
}

export function useBooking() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'book' | 'cancel' }) =>
      api.post<Session>(`/sessions/${id}/${action}`),
    onSuccess: () => invalidate('sessions', 'session', 'bookings'),
  });
}

export function useSaveSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Session> & { id?: number }) =>
      id ? api.patch<Session>(`/sessions/${id}`, body) : api.post<Session>('/sessions', body),
    onSuccess: () => invalidate('sessions', 'session', 'dashboard'),
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/sessions/${id}`),
    onSuccess: () => invalidate('sessions', 'dashboard'),
  });
}

export const useAttendance = (id: number) =>
  useQuery({ queryKey: keys.attendance(id), queryFn: () => api.get<Attendee[]>(`/sessions/${id}/attendance`) });

export function useSetAttendance(id: number) {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { attendees: { user: number; present: boolean }[]; close?: boolean }) =>
      api.post<Attendee[]>(`/sessions/${id}/attendance`, body),
    onSuccess: (data) => {
      qc.setQueryData(keys.attendance(id), data);
      invalidate('dashboard', 'session', 'sessions', 'members', 'summary');
    },
  });
}

export const useBookings = () =>
  useQuery({ queryKey: keys.bookings, queryFn: () => api.get<Booking[]>('/bookings') });

// ---- Exercices & modèles
export const useExercises = () =>
  useQuery({ queryKey: keys.exercises, queryFn: () => api.get<Exercise[]>('/exercises'), staleTime: 60_000 });

export function useSaveExercise() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Exercise> & { id?: number }) =>
      id ? api.patch<Exercise>(`/exercises/${id}`, body) : api.post<Exercise>('/exercises', body),
    onSuccess: () => invalidate('exercises', 'templates'),
  });
}

export function useDeleteExercise() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/exercises/${id}`),
    onSuccess: () => invalidate('exercises'),
  });
}

export const useTemplates = (enabled = true) =>
  useQuery({ queryKey: keys.templates, queryFn: () => api.get<WorkoutTemplate[]>('/templates'), enabled });

export function useSaveTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<WorkoutTemplate> & { id?: number }) =>
      id ? api.patch<WorkoutTemplate>(`/templates/${id}`, body) : api.post<WorkoutTemplate>('/templates', body),
    onSuccess: () => invalidate('templates', 'session'),
  });
}

export function useDeleteTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/templates/${id}`),
    onSuccess: () => invalidate('templates'),
  });
}

// ---- Performances & progression
export type PerfParams = { date?: string; user?: number; exercise?: number; booking?: number };

export const usePerformances = (params: PerfParams, enabled = true) =>
  useQuery({
    queryKey: keys.performances(params),
    queryFn: () => api.get<PerformanceSet[]>(`/performances${qs(params)}`),
    enabled,
  });

export const useLastPerformances = (exerciseIds: number[], user?: number, before?: string) =>
  useQuery({
    queryKey: keys.last({ exerciseIds, user, before }),
    queryFn: () =>
      api.get<Record<string, LastPerformance | null>>(
        `/performances/last${qs({ exercise: exerciseIds.join(','), user, before })}`,
      ),
    enabled: exerciseIds.length > 0,
  });

export type NewSet = {
  exercise: number;
  user?: number;
  booking?: number | null;
  date?: string;
  set_number: number;
  reps?: number | null;
  load_kg?: string | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
};

export function useAddSet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: NewSet) => api.post<PerformanceSet>('/performances', body),
    onSuccess: () => invalidate('performances', 'progress', 'summary'),
  });
}

export function useDeleteSet() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/performances/${id}`),
    onSuccess: () => invalidate('performances', 'progress', 'summary'),
  });
}

export const useProgressOverview = (member: string | number) =>
  useQuery({
    queryKey: keys.progress(member),
    queryFn: () => api.get<{ exercises: ExerciseOverview[] }>(`/members/${member}/progress`),
  });

export const useProgress = (member: string | number, exercise: number) =>
  useQuery({
    queryKey: keys.progress(member, exercise),
    queryFn: () => api.get<Progress>(`/members/${member}/progress?exercise=${exercise}`),
  });

// ---- Coach : adhérents, paiements, tableau de bord
export const useMembers = (params: { search?: string; payment_status?: PaymentStatus }) =>
  useQuery({ queryKey: keys.members(params), queryFn: () => api.get<Member[]>(`/members${qs(params)}`) });

export const useMemberSummary = (id: number) =>
  useQuery({ queryKey: keys.summary(id), queryFn: () => api.get<MemberSummary>(`/members/${id}/summary`) });

export function useSetMembership(id: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (status: 'active' | 'suspended') => api.patch(`/members/${id}/membership`, { status }),
    onSuccess: () => invalidate('summary', 'members', 'dashboard'),
  });
}

export const usePayments = (params: { user?: number }) =>
  useQuery({ queryKey: keys.payments(params), queryFn: () => api.get<Payment[]>(`/payments${qs(params)}`) });

export function useAddPayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: Omit<Payment, 'id' | 'user_name'>) => api.post<Payment>('/payments', body),
    onSuccess: () => invalidate('payments', 'summary', 'members', 'dashboard'),
  });
}

export function useDeletePayment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/payments/${id}`),
    onSuccess: () => invalidate('payments', 'summary', 'members', 'dashboard'),
  });
}

export const useSubscription = () =>
  useQuery({
    queryKey: keys.subscription,
    queryFn: () => api.get<{ status: PaymentStatus; paid_until: string | null }>('/subscription'),
  });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<Dashboard>('/dashboard') });

export function useRegenerateCode() {
  return useMutation({ mutationFn: () => api.post<Gym>('/gyms/mine/regenerate-code') });
}
