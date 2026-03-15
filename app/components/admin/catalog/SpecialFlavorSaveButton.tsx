'use client';

import React, { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { C } from './catalogUtils';

export default function SpecialFlavorSaveButton({ name, description, onSave }: { name: any, description: any, onSave: any }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave('special_flavor_name', name);
      await onSave('special_flavor_description', description);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: saved ? C.success : saving ? '#9CA3AF' : C.gold, color: saved ? '#fff' : '#000', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
    >
      {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
      {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Especial do Mês'}
    </button>
  );
}
