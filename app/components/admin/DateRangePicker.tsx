'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function yyyymmdd(d) {
  return d.toLocaleDateString('en-CA');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return yyyymmdd(d);
}

function buildPresets(today) {
  const ref = new Date(today + 'T12:00:00');
  const yest = addDays(today, -1);

  // Week is Sunday–Saturday (dow 0=Sun, 6=Sat)
  const dow = ref.getDay();
  const weekStart = new Date(ref);
  weekStart.setDate(ref.getDate() - dow);           // recua até domingo
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);         // sábado da mesma semana

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(weekStart.getDate() - 7);   // domingo da semana passada
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // sábado da semana passada

  // Month: 1st → last day (full month, including future days)
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const monthEnd   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);

  const lastMonthStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(ref.getFullYear(), ref.getMonth(), 0);

  const recentMonths = [];
  for (let i = 0; i < 3; i++) {
    const ms = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const me = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 0);
    const raw = ms.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const label = raw.replace(' de ', '/').replace(/^\w/, c => c.toUpperCase());
    recentMonths.push({ label, from: yyyymmdd(ms), to: yyyymmdd(me) });
  }

  return [
    { label: 'Hoje',             from: today,                    to: today                 },
    { label: 'Ontem',            from: yest,                     to: yest                  },
    { label: 'Últimos 7 dias',   from: addDays(today, -6),       to: today                 },
    { label: 'Últimos 30 dias',  from: addDays(today, -29),      to: today                 },
    { label: 'Esta semana',      from: yyyymmdd(weekStart),      to: yyyymmdd(weekEnd)     },
    { label: 'Semana passada',   from: yyyymmdd(lastWeekStart),  to: yyyymmdd(lastWeekEnd) },
    { label: 'Este mês',         from: yyyymmdd(monthStart),     to: yyyymmdd(monthEnd)    },
    { label: 'Mês passado',      from: yyyymmdd(lastMonthStart), to: yyyymmdd(lastMonthEnd)},
    ...recentMonths,
    { label: 'Últimos 2 meses', from: yyyymmdd(new Date(ref.getFullYear(), ref.getMonth() - 2, 1)), to: today },
    { label: 'Últimos 3 meses', from: yyyymmdd(new Date(ref.getFullYear(), ref.getMonth() - 3, 1)), to: today },
    { label: 'Últimos 6 meses', from: yyyymmdd(new Date(ref.getFullYear(), ref.getMonth() - 6, 1)), to: today },
  ];
}

const MONTH_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DOW_PT   = ['Do', 'Se', 'Te', 'Qu', 'Qu', 'Se', 'Sá'];

// ── MiniCalendar ──────────────────────────────────────────────────────────────

function MiniCalendar({ year, month, onPrev, onNext, from, to, onSelectDay, timeValue, onTimeChange }) {
  const firstDow  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const prevMDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstDow - 1; i >= 0; i--)
    cells.push({ d: prevMDays - i, cur: false });
  for (let d = 1; d <= daysInMon; d++)
    cells.push({ d, cur: true });
  while (cells.length < 42)
    cells.push({ d: cells.length - firstDow - daysInMon + 1, cur: false });

  function ds(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return (
    <div style={{ width: 270 }}>
      {/* Header: nav + time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={onPrev} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 7px', fontSize: 16, color: '#374151', borderRadius: 4 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', minWidth: 80, textAlign: 'center' }}>
            {MONTH_PT[month]}, {year}
          </span>
          <button onClick={onNext} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 7px', fontSize: 16, color: '#374151', borderRadius: 4 }}>›</button>
        </div>
        <input
          type="time"
          value={timeValue}
          onChange={e => onTimeChange(e.target.value)}
          style={{ border: '1px solid #E5E7EB', borderRadius: 4, padding: '3px 7px', fontSize: 12, color: '#374151', outline: 'none', width: 72 }}
        />
      </div>

      {/* Weekday labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {DOW_PT.map((d, i) => (
          <div key={i} style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textAlign: 'center', padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((c, i) => {
          const dateStr = c.cur ? ds(c.d) : null;
          const isFrom  = dateStr === from;
          const isTo    = dateStr === to;
          const isSel   = isFrom || isTo;
          const inRange = dateStr && from && to && dateStr > from && dateStr < to;
          return (
            <div
              key={i}
              onClick={() => c.cur && onSelectDay(ds(c.d))}
              style={{
                textAlign: 'center', padding: '6px 2px', fontSize: 13,
                cursor: c.cur ? 'pointer' : 'default',
                borderRadius: 4,
                background: isSel ? '#2563EB' : inRange ? '#DBEAFE' : 'transparent',
                color: isSel ? '#fff' : inRange ? '#1D4ED8' : c.cur ? '#111827' : '#D1D5DB',
                fontWeight: isSel ? 700 : 400,
              }}
            >
              {c.d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DateRangePicker ───────────────────────────────────────────────────────────

/**
 * Props:
 *   value:    { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', fromTime?: 'HH:MM', toTime?: 'HH:MM' }
 *   onChange: (value) => void   — called when user clicks OK
 */
export default function DateRangePicker({ value, onChange }) {
  const today = todayStr();
  const [open, setOpen]           = useState(false);
  const [tempFrom, setTempFrom]   = useState(value?.from || today);
  const [tempTo, setTempTo]       = useState(value?.to   || today);
  const [fromTime, setFromTime]   = useState(value?.fromTime || '00:00');
  const [toTime, setToTime]       = useState(value?.toTime   || '23:59');
  const [pickStep, setPickStep]   = useState(0); // 0 = picking from, 1 = picking to
  const [leftYear, setLeftYear]   = useState(() => parseInt((value?.from || today).split('-')[0]));
  const [leftMonth, setLeftMonth] = useState(() => parseInt((value?.from || today).split('-')[1]) - 1);
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0 });
  const ref = useRef(null);

  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear;
  const rightMonth = (leftMonth + 1) % 12;
  const presets    = buildPresets(today);

  // Sync internal state when value prop changes
  useEffect(() => {
    if (value?.from) setTempFrom(value.from);
    if (value?.to)   setTempTo(value.to);
    if (value?.fromTime) setFromTime(value.fromTime);
    if (value?.toTime)   setToTime(value.toTime);
  }, [value?.from, value?.to]);

  useEffect(() => {
    function outside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  function handleToggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const viewW = window.innerWidth;
      const dropW = 820;
      let left = rect.right - dropW;
      if (left < 8) left = 8;
      if (left + dropW > viewW - 8) left = viewW - dropW - 8;
      // Determine if dropdown should open upward
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < 460 ? Math.max(8, rect.top - 460) : rect.bottom + 6;
      setDropPos({ top, left });
    }
    setOpen(v => !v);
  }

  function handleSelectDay(dateStr) {
    if (pickStep === 0) {
      setTempFrom(dateStr);
      setTempTo(dateStr);
      setPickStep(1);
    } else {
      if (dateStr < tempFrom) {
        setTempFrom(dateStr);
        setPickStep(1);
      } else {
        setTempTo(dateStr);
        setPickStep(0);
      }
    }
  }

  function applyPreset(p) {
    setTempFrom(p.from);
    setTempTo(p.to);
    setFromTime('00:00');
    setToTime('23:59');
    setPickStep(0);
    const [y, m] = p.from.split('-');
    setLeftYear(parseInt(y));
    setLeftMonth(parseInt(m) - 1);
  }

  function handleOK() {
    onChange({ from: tempFrom, to: tempTo, fromTime, toTime });
    setOpen(false);
  }

  function prevMonth() {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(y => y - 1); }
    else setLeftMonth(m => m - 1);
  }
  function nextMonth() {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(y => y + 1); }
    else setLeftMonth(m => m + 1);
  }

  function fmtDisplay(from, to, ft, tt) {
    if (!from) return 'Selecionar período';
    const f = from.split('-').reverse().join('/');
    const t = to  ? to.split('-').reverse().join('/') : f;
    return `${f} ${ft || '00:00'} ~ ${t} ${tt || '23:59'}`;
  }

  const isPresetActive = (p) => tempFrom === p.from && tempTo === p.to;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 14px', border: '1px solid #E5E7EB',
          borderRadius: 8, background: '#fff', cursor: 'pointer',
          fontSize: 12, color: '#374151', fontWeight: 500,
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)', userSelect: 'none',
          fontFamily: 'monospace',
        }}
      >
        {fmtDisplay(value?.from, value?.to, value?.fromTime, value?.toTime)}
        <CalendarDays size={14} color="#9CA3AF" style={{ flexShrink: 0, fontFamily: 'inherit' }} />
      </div>

      {/* Dropdown — uses position:fixed to avoid overflow clipping */}
      {open && (
        <div style={{
          position: 'fixed',
          top: dropPos.top,
          left: dropPos.left,
          zIndex: 99999,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 8px 40px rgba(0,0,0,0.22)', border: '1px solid #E5E7EB',
          display: 'flex', width: 820,
        }}>
          {/* Left: presets */}
          <div style={{ borderRight: '1px solid #E5E7EB', padding: '12px 0', width: 182, flexShrink: 0, overflowY: 'auto', maxHeight: 460 }}>
            {presets.map((p, i) => (
              <div
                key={i}
                onClick={() => applyPreset(p)}
                style={{
                  padding: '7px 18px', fontSize: 13, cursor: 'pointer',
                  color: '#2563EB',
                  fontWeight: isPresetActive(p) ? 700 : 400,
                  background: isPresetActive(p) ? '#EFF6FF' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isPresetActive(p)) e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isPresetActive(p) ? '#EFF6FF' : 'transparent'; }}
              >
                {p.label}
              </div>
            ))}
          </div>

          {/* Right: range text + two calendars + OK */}
          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Range display */}
            <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, fontFamily: 'monospace', letterSpacing: 0.2 }}>
              {fmtDisplay(tempFrom, tempTo, fromTime, toTime)}
            </div>
            <div style={{ height: 1, background: '#E5E7EB' }} />

            {/* Two calendars */}
            <div style={{ display: 'flex', gap: 16 }}>
              <MiniCalendar
                year={leftYear} month={leftMonth}
                onPrev={prevMonth} onNext={nextMonth}
                from={tempFrom} to={tempTo}
                onSelectDay={handleSelectDay}
                timeValue={fromTime} onTimeChange={setFromTime}
              />
              <div style={{ width: 1, background: '#E5E7EB', flexShrink: 0 }} />
              <MiniCalendar
                year={rightYear} month={rightMonth}
                onPrev={prevMonth} onNext={nextMonth}
                from={tempFrom} to={tempTo}
                onSelectDay={handleSelectDay}
                timeValue={toTime} onTimeChange={setToTime}
              />
            </div>

            {/* OK */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
              <button
                onClick={handleOK}
                style={{
                  padding: '8px 28px', borderRadius: 6, border: 'none',
                  background: '#2563EB', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
