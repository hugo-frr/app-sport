export type Role = 'coach' | 'member';
export type Unit = 'kg_reps' | 'time' | 'distance';
export type SessionStatus = 'draft' | 'published' | 'done';
export type BookingStatus = 'booked' | 'cancelled' | 'present' | 'absent';
export type PaymentStatus = 'up_to_date' | 'late';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'cheque' | 'other';

export interface Gym {
  id: number;
  name: string;
  address: string;
  cancellation_deadline_hours: number;
  invite_code?: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: Role;
  gym: Gym | null;
  date_joined: string;
}

export interface Exercise {
  id: number;
  name: string;
  category: string;
  unit: Unit;
  higher_is_better: boolean;
  video_url: string;
  description: string;
}

export interface TemplateItem {
  id?: number;
  exercise: number;
  exercise_name?: string;
  exercise_unit?: Unit;
  exercise_video_url?: string;
  order: number;
  sets: number;
  reps: number | null;
  target_load_kg: string | null;
  target_duration_seconds: number | null;
  target_distance_m: number | null;
  rest_seconds: number | null;
  notes: string;
}

export interface WorkoutTemplate {
  id: number;
  name: string;
  description: string;
  items: TemplateItem[];
}

export interface MyBooking {
  id: number;
  status: BookingStatus;
  booked_at: string;
}

export interface Session {
  id: number;
  title: string;
  kind: 'group' | 'individual';
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  status: SessionStatus;
  notes: string;
  template: number | null;
  template_name: string | null;
  coach: number | null;
  coach_name: string | null;
  booked_count: number | null;
  spots_left: number;
  my_booking: MyBooking | null;
  can_cancel_until: string;
  items?: TemplateItem[];
}

export interface Booking {
  id: number;
  user_id: number;
  status: BookingStatus;
  booked_at: string;
  session: Pick<Session, 'id' | 'title' | 'kind' | 'starts_at' | 'duration_minutes' | 'status' | 'template' | 'coach_name'>;
}

export interface Attendee {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: BookingStatus;
}

export interface PerformanceSet {
  id: number;
  user: number;
  exercise: number;
  exercise_name: string;
  exercise_unit: Unit;
  booking: number | null;
  date: string;
  set_number: number;
  reps: number | null;
  load_kg: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  rpe: string | null;
  record: { metric: string; value: number; previous: number } | null;
}

export interface LastSet {
  set_number: number;
  reps: number | null;
  load_kg: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
}

export interface LastPerformance {
  date: string;
  sets: LastSet[];
}

export interface ProgressPoint {
  date: string;
  max_load: number | null;
  volume: number | null;
  estimated_1rm: number | null;
  total_reps: number | null;
  max_reps: number | null;
  best_duration: number | null;
  max_distance: number | null;
  total_distance: number | null;
}

export interface RecordValue {
  value: number;
  date: string;
}

export interface Progress {
  exercise: { id: number; name: string; unit: Unit; higher_is_better: boolean };
  points: ProgressPoint[];
  records: Record<
    'max_load' | 'estimated_1rm' | 'max_volume' | 'max_reps' | 'best_duration' | 'max_distance',
    RecordValue | null
  >;
  sessions_count: number;
  last: LastPerformance | null;
}

export interface ExerciseOverview {
  exercise: number;
  name: string;
  category: string;
  unit: Unit;
  last_date: string;
  sessions_count: number;
  max_load: number | null;
}

export interface Member {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  membership_status: 'active' | 'suspended';
  joined_at: string;
  last_visit: string | null;
  paid_until: string | null;
  payment_status: PaymentStatus;
}

export interface Payment {
  id: number;
  user: number;
  user_name?: string;
  amount_cents: number;
  paid_on: string;
  method: PaymentMethod;
  period_start: string;
  period_end: string;
  note: string;
}

export interface MemberSummary {
  member: Member;
  attendance_last_30_days: number;
  recent_bookings: { id: number; status: BookingStatus; session: { id: number; title: string; starts_at: string } }[];
  recent_performances: (LastSet & { id: number; date: string; exercise: number; exercise_name: string; unit: Unit })[];
  payments: Payment[];
}

export interface Dashboard {
  week: { start: string; days: { date: string; present: number }[]; total_present: number };
  members_count: number;
  inactive_days: number;
  inactive_members: Member[];
  unpaid_members: Member[];
  today_sessions: {
    id: number;
    title: string;
    starts_at: string;
    capacity: number;
    booked: number;
    present: number;
    status: SessionStatus;
  }[];
}
