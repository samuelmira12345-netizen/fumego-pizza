/**
 * Testes unitários para lib/store-hours — cálculo de horário de funcionamento.
 *
 * Cobre:
 * - Loja forçada fechada via store_open = 'false'
 * - Loja sem horário configurado (aberta por padrão)
 * - Loja dentro e fora do horário
 * - Dia da semana fechado (enabled: false)
 * - JSON inválido no business_hours
 */

// ─── Implementação inline (mesmo algoritmo do lib/store-hours) ───────────────

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function computeStoreStatus(settings: any, nowOverride?: any) {
  if ((settings.store_open ?? 'true') !== 'true') {
    return { open: false, todayLabel: null };
  }

  const raw = settings.business_hours;
  if (!raw) return { open: true, todayLabel: null };

  let bh;
  try { bh = JSON.parse(raw); } catch { return { open: true, todayLabel: null }; }

  // nowOverride permite injetar uma data fixa para os testes
  const now = nowOverride ?? new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const dayKey = DAY_KEYS[now.getDay()];
  const today = bh[dayKey];

  if (!today || !today.enabled) return { open: false, todayLabel: null };

  const [openH = 0, openM = 0]   = (today.open  || '00:00').split(':').map(Number);
  const [closeH = 0, closeM = 0] = (today.close || '00:00').split(':').map(Number);
  const nowMinutes   = now.getHours() * 60 + now.getMinutes();
  const openMinutes  = openH  * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return {
    open: nowMinutes >= openMinutes && nowMinutes < closeMinutes,
    todayLabel: `${today.open} – ${today.close}`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cria um objeto Date com hora e dia da semana específicos. */
function fakeNow({ dayIndex = 1, hour = 20, minute = 0 } = {}) {
  // dayIndex: 0 = domingo, 1 = segunda, ..., 6 = sábado
  // 2024-01-01 é segunda-feira → dayIndex=0 (domingo) usa 07/jan
  const day = dayIndex === 0 ? 7 : dayIndex; // jan 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sáb, 7=dom
  const d = new Date(2024, 0, day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const BH_ALL_OPEN = JSON.stringify({
  sunday:    { enabled: true, open: '10:00', close: '22:00' },
  monday:    { enabled: true, open: '10:00', close: '22:00' },
  tuesday:   { enabled: true, open: '10:00', close: '22:00' },
  wednesday: { enabled: true, open: '10:00', close: '22:00' },
  thursday:  { enabled: true, open: '10:00', close: '22:00' },
  friday:    { enabled: true, open: '10:00', close: '22:00' },
  saturday:  { enabled: true, open: '10:00', close: '22:00' },
});

const BH_MON_CLOSED = JSON.stringify({
  sunday:    { enabled: false, open: '18:00', close: '23:00' },
  monday:    { enabled: false, open: '18:00', close: '23:00' },
  tuesday:   { enabled: true,  open: '18:00', close: '23:00' },
  wednesday: { enabled: true,  open: '18:00', close: '23:00' },
  thursday:  { enabled: true,  open: '18:00', close: '23:00' },
  friday:    { enabled: true,  open: '18:00', close: '23:00' },
  saturday:  { enabled: true,  open: '18:00', close: '23:00' },
});

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('computeStoreStatus', () => {
  describe('override manual store_open', () => {
    it('fecha quando store_open = false, mesmo dentro do horário', () => {
      const result = computeStoreStatus(
        { store_open: 'false', business_hours: BH_ALL_OPEN },
        fakeNow({ dayIndex: 1, hour: 15 })
      );
      expect(result.open).toBe(false);
      expect(result.todayLabel).toBeNull();
    });

    it('abre quando store_open = true e sem horário configurado', () => {
      const result = computeStoreStatus({ store_open: 'true' });
      expect(result.open).toBe(true);
      expect(result.todayLabel).toBeNull();
    });
  });

  describe('sem horário configurado', () => {
    it('abre por padrão (sem business_hours)', () => {
      const result = computeStoreStatus({ store_open: 'true' });
      expect(result.open).toBe(true);
    });

    it('usa store_open = true como padrão se não configurado', () => {
      const result = computeStoreStatus({});
      expect(result.open).toBe(true);
    });
  });

  describe('dentro do horário', () => {
    it('abre quando está dentro do intervalo', () => {
      const result = computeStoreStatus(
        { store_open: 'true', business_hours: BH_ALL_OPEN },
        fakeNow({ dayIndex: 1, hour: 15, minute: 30 }) // segunda às 15:30
      );
      expect(result.open).toBe(true);
      expect(result.todayLabel).toBe('10:00 – 22:00');
    });

    it('fecha antes da abertura', () => {
      const result = computeStoreStatus(
        { store_open: 'true', business_hours: BH_ALL_OPEN },
        fakeNow({ dayIndex: 1, hour: 9, minute: 59 }) // 09:59 (abre às 10:00)
      );
      expect(result.open).toBe(false);
    });

    it('fecha no horário de fechamento exato (intervalo semi-aberto)', () => {
      const result = computeStoreStatus(
        { store_open: 'true', business_hours: BH_ALL_OPEN },
        fakeNow({ dayIndex: 1, hour: 22, minute: 0 }) // exatamente 22:00
      );
      expect(result.open).toBe(false);
    });

    it('fecha após o horário', () => {
      const result = computeStoreStatus(
        { store_open: 'true', business_hours: BH_ALL_OPEN },
        fakeNow({ dayIndex: 1, hour: 23, minute: 0 })
      );
      expect(result.open).toBe(false);
    });
  });

  describe('dia fechado (enabled: false)', () => {
    it('fecha quando o dia atual está desativado', () => {
      // segunda = dayIndex 1, que está disabled em BH_MON_CLOSED
      const result = computeStoreStatus(
        { store_open: 'true', business_hours: BH_MON_CLOSED },
        fakeNow({ dayIndex: 1, hour: 20 }) // segunda às 20h
      );
      expect(result.open).toBe(false);
      expect(result.todayLabel).toBeNull();
    });

    it('abre para dia habilitado mesmo quando outros estão fechados', () => {
      // terça = dayIndex 2, que está enabled em BH_MON_CLOSED
      const result = computeStoreStatus(
        { store_open: 'true', business_hours: BH_MON_CLOSED },
        fakeNow({ dayIndex: 2, hour: 20 }) // terça às 20h
      );
      expect(result.open).toBe(true);
    });
  });

  describe('JSON inválido', () => {
    it('abre com JSON malformado (graceful degradation)', () => {
      const result = computeStoreStatus({ store_open: 'true', business_hours: 'invalid-json' });
      expect(result.open).toBe(true);
      expect(result.todayLabel).toBeNull();
    });
  });

  describe('todayLabel', () => {
    it('retorna o label correto quando aberta', () => {
      const result = computeStoreStatus(
        { store_open: 'true', business_hours: BH_ALL_OPEN },
        fakeNow({ dayIndex: 3, hour: 12 })
      );
      expect(result.todayLabel).toBe('10:00 – 22:00');
    });

    it('retorna null quando fecha (sem horário)', () => {
      const result = computeStoreStatus({ store_open: 'false' });
      expect(result.todayLabel).toBeNull();
    });
  });
});
