// lib/store-hours.ts
// Utility for computing whether the store is open based on settings.
// Uses Brasília timezone (America/Sao_Paulo = UTC-3).

type DayKey = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

interface DayHours {
  enabled: boolean;
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
}

type BusinessHours = Record<DayKey, DayHours>;

interface StoreSettings {
  store_open?: string;
  business_hours?: string;
}

interface StoreStatus {
  open: boolean;
  todayLabel: string | null;
}

const DAY_KEYS: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const DAY_LABELS: Record<DayKey, string> = {
  sunday:    'Domingo',
  monday:    'Segunda',
  tuesday:   'Terça',
  wednesday: 'Quarta',
  thursday:  'Quinta',
  friday:    'Sexta',
  saturday:  'Sábado',
};

export const DAY_ORDER: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  sunday:    { enabled: false, open: '18:00', close: '23:00' },
  monday:    { enabled: true,  open: '18:00', close: '23:00' },
  tuesday:   { enabled: true,  open: '18:00', close: '23:00' },
  wednesday: { enabled: true,  open: '18:00', close: '23:00' },
  thursday:  { enabled: true,  open: '18:00', close: '23:00' },
  friday:    { enabled: true,  open: '18:00', close: '23:00' },
  saturday:  { enabled: true,  open: '18:00', close: '23:00' },
};

/**
 * Computes whether the store is currently open based on settings.
 *
 * Logic:
 *  1. If store_open !== 'true'  → manually closed (always closed)
 *  2. If no business_hours set  → open (no schedule restriction)
 *  3. If business_hours set     → check today's day and time in Brasília
 *
 * @returns `{ open, todayLabel }` — todayLabel is "HH:MM – HH:MM" or null
 */
export function computeStoreStatus(settings: StoreSettings): StoreStatus {
  // Manual override: admin can force-close regardless of hours
  if ((settings.store_open ?? 'true') !== 'true') {
    return { open: false, todayLabel: null };
  }

  const raw = settings.business_hours;
  if (!raw) {
    return { open: true, todayLabel: null };
  }

  let bh: BusinessHours;
  try {
    bh = JSON.parse(raw) as BusinessHours;
  } catch {
    return { open: true, todayLabel: null };
  }

  // Current time in Brasília (America/Sao_Paulo)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayKey = DAY_KEYS[now.getDay()];
  const today = bh[dayKey];

  if (!today?.enabled) {
    return { open: false, todayLabel: null };
  }

  const [openH = 0, openM = 0]   = (today.open  || '00:00').split(':').map(Number);
  const [closeH = 0, closeM = 0] = (today.close || '00:00').split(':').map(Number);
  const nowMinutes   = now.getHours() * 60 + now.getMinutes();
  const openMinutes  = openH  * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  return { open: isOpen, todayLabel: `${today.open} – ${today.close}` };
}
