'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed, GlassWater, Package, Upload, Loader2, Trash2,
  Plus, Check, ChevronDown, ChevronUp, Save, RefreshCw,
  DollarSign, TrendingDown, BookOpen, X, Eye, EyeOff, Copy,
  BarChart2, TrendingUp, Layers, ArrowDownUp, Warehouse, Star,
} from 'lucide-react';
import { parseCorrectionLoss, costWithFC } from '@/lib/correction-factor';
import {
  PROD_CATEGORIES, FILTER_TABS, UNITS, UNIT_SUB, C,
  fmtBRL, formatCorrectionPercent, toBaseQty, getUnitOptions,
} from './catalog/catalogUtils';
import { clientError } from '../../../lib/client-logger';
import PriceLineChart from './catalog/PriceLineChart';
import SpecialFlavorSaveButton from './catalog/SpecialFlavorSaveButton';
import FichaTecnica from './catalog/FichaTecnica';
import CompoundRecipePanel from './catalog/CompoundRecipePanel';
import DrinkRow from './catalog/DrinkRow';
import ProductRow from './catalog/ProductRow';

// ── Catalog Main ───────────────────────────────────────────────────────────────

export default function Catalog({ adminToken }: { adminToken: any }) {
  const [tab, setTab]           = useState('cardapio'); // 'cardapio' | 'insumos' | 'analise' | 'especial'
  const [catFilter, setCatFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<any>(null); // product id currently expanded for editing

  const [products, setProducts]   = useState<any[]>([]);
  const [drinks, setDrinks]       = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes]     = useState<any>({}); // { [productId]: [{ ingredient_id, quantity }] }
  const [priceHistory, setPriceHistory] = useState<any[]>([]); // for Análise tab
  const [compoundItems, setCompoundItems] = useState<any[]>([]); // [{ compound_id, ingredient_id, quantity }]

  // Stock movement UI state
  const [stockPanelIngId, setStockPanelIngId] = useState<any>(null); // ingredient id with open stock panel
  const [stockMovement, setStockMovement] = useState<any>({ type: 'in', quantity: '', reason: '', notes: '' });
  const [savingStockMovement, setSavingStockMovement] = useState(false);

  // Compound recipe panel
  const [compoundPanelIngId, setCompoundPanelIngId] = useState<any>(null); // ingredient id with open compound panel
  const [savingCompoundRecipe, setSavingCompoundRecipe] = useState(false);

  // Per-ingredient stock movement chart
  const [ingMovements, setIngMovements] = useState<any>({}); // { [ingredient_id]: movements[] }

  // Settings needed for stock limits and image positions
  const [settings, setSettings]   = useState<any[]>([]);

  const [loading, setLoading]     = useState(true);
  const [savingProductId, setSavingProductId] = useState<any>(null);
  const [savingDrinkId, setSavingDrinkId] = useState<any>(null);
  const [msg, setMsg]             = useState('');
  const [uploadingId, setUploadingId] = useState<any>(null);
  const [uploadingUpsellIdx, setUploadingUpsellIdx] = useState<any>(null);

  // New product form
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: 'pizza', price: '', description: '' });
  const [addingProduct, setAddingProduct] = useState(false);

  // New drink form
  const [showNewDrink, setShowNewDrink] = useState(false);
  const [newDrink, setNewDrink]   = useState({ name: '', size: '', price: '' });
  const [addingDrink, setAddingDrink] = useState(false);
  const [expandedDrinkId, setExpandedDrinkId] = useState<any>(null);

  // New ingredient form
  const [newIng, setNewIng]       = useState({ name: '', unit: 'unid', cost_per_unit: '', ingredient_type: 'simple', correction_factor: '0.00', min_stock: '', max_stock: '', purchase_origin: '', weight_volume: '1.000', density: '' });
  const [addingIng, setAddingIng] = useState(false);
  const [showNewIngModal, setShowNewIngModal] = useState(false);

  // Density popup: shown when a liquid unit (L or ml) is selected
  const LIQUID_UNITS = ['L', 'ml'];
  const [densityPrompt, setDensityPrompt] = useState<{ target: 'new' | string; pendingUnit: string; value: string } | null>(null);

  // Edit ingredient inline
  const [editingIng, setEditingIng] = useState<any>(null); // ingredient id

  // Price history panel: selected ingredient id
  const [selectedIngForHistory, setSelectedIngForHistory] = useState<any>(null);

  // Upsell config editing state
  const [savingUpsellSlotIdx, setSavingUpsellSlotIdx] = useState<any>(null); // idx do slot sendo salvo
  const blankUpsell = () => ({ enabled: false, product_id: null, offer_label: 'Aproveite e adicione:', show_image: true, custom_price: null, custom_image_url: null });
  const [upsellSlots, setUpsellSlots] = useState<any[]>([blankUpsell(), blankUpsell(), blankUpsell()]);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, extraRes] = await Promise.all([
        fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'get_data' }) }),
        fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'get_catalog_extra' }) }),
      ]);

      const catalog = await catalogRes.json();
      const extra   = await extraRes.json();

      setProducts(catalog.products || []);
      setDrinks(catalog.drinks || []);
      const rawSettings = catalog.settings || [];
      setSettings(rawSettings);

      // Initialize upsell slots from saved config
      const savedUpsell = rawSettings.find((s: any) => s.key === 'upsell_config')?.value;
      if (savedUpsell) {
        try {
          const parsed = JSON.parse(savedUpsell);
          const blank = () => ({ enabled: false, product_id: null, offer_label: 'Aproveite e adicione:', show_image: true, custom_price: null, custom_image_url: null });
          const normalize = (slot: any) => ({ ...blank(), ...(slot || {}), product_id: slot?.product_id != null ? String(slot.product_id) : null });
          if (Array.isArray(parsed)) {
            setUpsellSlots([0, 1, 2].map(i => normalize(parsed[i])));
          } else {
            setUpsellSlots([normalize(parsed), blank(), blank()]);
          }
        } catch {}
      }

      setIngredients(extra.ingredients || []);
      setPriceHistory(extra.priceHistory || []);
      setCompoundItems(extra.compoundItems || []);

      // Build recipes map: { [productId]: [{ ingredient_id, quantity }] }
      const recipeMap: Record<string, any[]> = {};
      for (const item of (extra.recipes || [])) {
        if (!recipeMap[item.product_id]) recipeMap[item.product_id] = [];
        recipeMap[item.product_id].push({ ingredient_id: item.ingredient_id, quantity: item.quantity });
      }
      setRecipes(recipeMap);
    } catch (e) {
      clientError(e);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  // Fetch stock movements when a stock panel opens (for chart)
  useEffect(() => {
    if (!stockPanelIngId || ingMovements[stockPanelIngId]) return;
    fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action: 'get_stock_movements', data: { ingredient_id: stockPanelIngId, limit: 30 } }),
    }).then(r => r.json()).then(d => {
      if (d.movements) {
        setIngMovements((prev: any) => ({ ...prev, [stockPanelIngId]: d.movements.slice().reverse() }));
      }
    }).catch(() => {});
  }, [stockPanelIngId]);

  // ── Settings helpers ─────────────────────────────────────────────────────────

  function getSetting(key: any) {
    return (settings as any[]).find((s: any) => s.key === key)?.value || '';
  }

  function setSetting(key: any, value: any) {
    setSettings((prev: any[]) => {
      const idx = prev.findIndex((s: any) => s.key === key);
      if (idx >= 0) return prev.map((s: any, i: any) => i === idx ? { ...s, value } : s);
      return [...prev, { key, value }];
    });
  }

  async function saveSetting(key: any, value: any) {
    setSetting(key, value);
    try {
      await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_setting', data: { key, value } }),
      });
    } catch (e) { clientError('Erro ao salvar configuração:', e); }
  }

  function getImagePositions() {
    try { return JSON.parse(getSetting('image_positions') || '{}'); } catch { return {}; }
  }

  function updateImagePosition(productId: any, x: any, y: any) {
    const curr = getImagePositions();
    setSetting('image_positions', JSON.stringify({ ...curr, [String(productId)]: { x, y } }));
  }

  function getStockLimits() {
    try { return JSON.parse(getSetting('stock_limits') || '{}'); } catch { return {}; }
  }

  function updateStockLimit(productId: any, field: any, value: any) {
    const curr = getStockLimits();
    const existing = curr[String(productId)] || { enabled: false, qty: 0, low_stock_threshold: 3 };
    const entry = { ...existing, [field]: value };
    setSetting('stock_limits', JSON.stringify({ ...curr, [String(productId)]: entry }));

    // Sincroniza is_active do produto com o estoque (igual ao comportamento das bebidas)
    if (field === 'qty' || field === 'enabled') {
      const isEnabled = field === 'enabled' ? value : existing.enabled;
      const qty = field === 'qty' ? value : existing.qty;
      const outOfStock = isEnabled && qty <= 0;
      setProducts(prev => prev.map(p => String(p.id) === String(productId) ? { ...p, is_active: !outOfStock } : p));
    }
  }

  function getDrinkStockLimits() {
    try { return JSON.parse(getSetting('drink_stock_limits') || '{}'); } catch { return {}; }
  }

  async function saveUpsellConfig(configs: any, slotIdx: any = null) {
    setUpsellSlots(configs);
    setSetting('upsell_config', JSON.stringify(configs));
    setSavingUpsellSlotIdx(slotIdx);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_setting', data: { key: 'upsell_config', value: JSON.stringify(configs) } }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Upsell salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Erro ao salvar upsell'); }
    finally { setSavingUpsellSlotIdx(null); }
  }

  function updateDrinkStockLimit(drinkId: any, field: any, value: any) {
    const curr = getDrinkStockLimits();
    const existing = curr[String(drinkId)] || { enabled: false, qty: 0 };
    const entry = { ...existing, [field]: value };
    setSetting('drink_stock_limits', JSON.stringify({ ...curr, [String(drinkId)]: entry }));

    if (field === 'qty' || field === 'enabled') {
      const outOfStock = (field === 'enabled' ? value : existing.enabled) && (field === 'qty' ? value <= 0 : existing.qty <= 0);
      setDrinks(prev => prev.map(d => String(d.id) === String(drinkId) ? { ...d, is_active: !outOfStock } : d));
    }
  }

  // ── CRUD helpers ─────────────────────────────────────────────────────────────

  function updateProduct(idx: any, field: any, value: any) {
    setProducts((prev: any[]) => { const p = [...prev]; p[idx] = { ...p[idx], [field]: value }; return p; });
  }

  function updateDrink(idx: any, field: any, value: any) {
    setDrinks((prev: any[]) => { const d = [...prev]; d[idx] = { ...d[idx], [field]: value }; return d; });
  }

  // ── Save / toggles ───────────────────────────────────────────────────────────

  async function toggleProductFlag(productId: any, field: any, value: any) {
    if (!['is_active', 'is_hidden'].includes(field)) return;
    setSavingProductId(productId);
    const prevProducts = products;
    setProducts(prev => prev.map(p => String(p.id) === String(productId) ? { ...p, [field]: value } : p));

    try {
      const payload = { id: productId, [field]: value };
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'update_product_flags', data: payload }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Erro ao atualizar produto');
      if (d.product) setProducts(prev => prev.map(p => String(p.id) === String(productId) ? d.product : p));
      setMsg('✅ Produto atualizado!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setProducts(prevProducts);
      setMsg('❌ ' + ((e as Error).message || 'Erro ao atualizar produto'));
    } finally {
      setSavingProductId(null);
    }
  }

  async function toggleDrinkFlag(drinkId: any, field: any, value: any) {
    if (!['is_active', 'is_hidden'].includes(field)) return;
    setSavingDrinkId(drinkId);
    const prevDrinks = drinks;
    setDrinks(prev => prev.map(d => String(d.id) === String(drinkId) ? { ...d, [field]: value } : d));

    try {
      const payload = { id: drinkId, [field]: value };
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'update_drink_flags', data: payload }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Erro ao atualizar bebida');
      if (d.drink) setDrinks(prev => prev.map(item => String(item.id) === String(drinkId) ? d.drink : item));
      setMsg('✅ Bebida atualizada!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setDrinks(prevDrinks);
      setMsg('❌ ' + ((e as Error).message || 'Erro ao atualizar bebida'));
    } finally {
      setSavingDrinkId(null);
    }
  }

  async function saveProduct(product: any) {
    if (!product) return;
    setSavingProductId(product.id);
    setMsg('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_all', data: { products: [product], settings } }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Produto salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Erro ao salvar produto'); }
    finally { setSavingProductId(null); }
  }

  async function saveDrink(drink: any) {
    if (!drink) return;
    setSavingDrinkId(drink.id);
    setMsg('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'save_all', data: { drinks: [drink], settings } }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Bebida salva!');
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('❌ Erro ao salvar bebida'); }
    finally { setSavingDrinkId(null); }
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  async function handleImageUpload(productIdx: any, file: any) {
    const product = products[productIdx];
    if (!file || !product) return;
    setUploadingId(product.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', `product-${product.id}`);
      formData.append('saveAs', 'product_image');
      formData.append('productId', product.id);
      const res = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` }, body: formData });
      const result = await res.json();
      if (!res.ok) { alert('Erro no upload: ' + result.error); return; }
      updateProduct(productIdx, 'image_url', result.url);
      alert('✅ Foto enviada!');
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setUploadingId(null); }
  }

  async function handleUpsellImageUpload(idx: any, file: any) {
    if (!file) return;
    setUploadingUpsellIdx(idx);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prefix', `upsell-${idx}`);
      const res = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': `Bearer ${adminToken}` }, body: formData });
      const result = await res.json();
      if (!res.ok) { setMsg('❌ Erro no upload: ' + result.error); return; }
      const next = upsellSlots.map((u, i) => i === idx ? { ...u, custom_image_url: result.url } : u);
      saveUpsellConfig(next);
    } catch (e) { setMsg('❌ Erro no upload: ' + (e as Error).message); }
    finally { setUploadingUpsellIdx(null); }
  }

  // ── Drinks ───────────────────────────────────────────────────────────────────

  async function handleAddDrink() {
    if (!newDrink.name || !newDrink.price) { alert('Nome e preço são obrigatórios'); return; }
    setAddingDrink(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'add_drink', data: { name: newDrink.name, size: newDrink.size, price: parseFloat(newDrink.price), is_active: true } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.drink) {
        setDrinks(prev => [...prev, d.drink]);
        setExpandedDrinkId(d.drink.id);
      }
      setNewDrink({ name: '', size: '', price: '' });
      setShowNewDrink(false);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setAddingDrink(false); }
  }

  async function handleDeleteDrink(drinkId: any) {
    if (!confirm('Excluir esta bebida?')) return;
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'delete_drink', data: { id: drinkId } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setDrinks(prev => prev.filter((dr: any) => dr.id !== drinkId));
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  async function handleDeleteProduct(productId: any) {
    if (!confirm('Excluir este produto? Essa ação não pode ser desfeita.')) return;
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'delete_product', data: { id: productId } }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Erro ao excluir produto');
      setProducts(prev => prev.filter((p) => String(p.id) !== String(productId)));
      setExpandedId((prev: any) => (String(prev) === String(productId) ? null : prev));
      setRecipes((prev: any) => {
        const next = { ...prev };
        delete next[productId];
        delete next[String(productId)];
        return next;
      });
      setMsg('✅ Produto excluído!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('❌ ' + ((e as Error).message || 'Erro ao excluir produto'));
    }
  }

  // ── Ingredients ──────────────────────────────────────────────────────────────

  async function handleAddIngredient() {
    if (!newIng.name) { alert('Nome é obrigatório'); return; }
    setAddingIng(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_ingredient', data: {
        name: newIng.name,
        unit: newIng.unit,
        cost_per_unit: parseFloat(newIng.cost_per_unit) || 0,
        ingredient_type: newIng.ingredient_type || 'simple',
        correction_factor: parseCorrectionLoss(newIng.correction_factor),
        min_stock: parseFloat(newIng.min_stock) || 0,
        max_stock: parseFloat(newIng.max_stock) || 0,
        purchase_origin: newIng.purchase_origin || '',
        weight_volume: parseFloat(newIng.weight_volume) || 1.0,
        density: LIQUID_UNITS.includes(newIng.unit) && newIng.density ? parseFloat(newIng.density) || null : null,
      } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.ingredient) setIngredients((prev: any[]) => [...prev, d.ingredient].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')));
      setNewIng({ name: '', unit: 'unid', cost_per_unit: '', ingredient_type: 'simple', correction_factor: '0.00', min_stock: '', max_stock: '', purchase_origin: '', weight_volume: '1.000', density: '' });
      setShowNewIngModal(false);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setAddingIng(false); }
  }

  async function handleUpdateIngredient(id: any, field: any, value: any) {
    // When switching to a liquid unit, ask for density before applying
    if (field === 'unit' && LIQUID_UNITS.includes(value)) {
      setDensityPrompt({ target: id, pendingUnit: value, value: '' });
      return;
    }
    setIngredients((prev: any[]) => prev.map((i: any) => i.id === id ? { ...i, [field]: value } : i));
  }

  async function handleSaveIngredient(ingredient: any) {
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_ingredient', data: ingredient }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      // Update ingredient in state
      if (ingredient.id) {
        setIngredients(prev => prev.map(i => i.id === ingredient.id ? { ...i, ...ingredient } : i));
      }
      // Real-time chart update: add new history entry if price changed
      if (d.priceHistoryEntry) {
        setPriceHistory(prev => [...prev, d.priceHistoryEntry]);
      }
      setEditingIng(null);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  async function handleSaveCompoundRecipe(compound_id: any, items: any, computedCost: any) {
    setSavingCompoundRecipe(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_compound_recipe', data: { compound_id, items, computed_cost: computedCost } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      // Update local compoundItems state
      setCompoundItems((prev: any[]) => {
        const filtered = prev.filter((c: any) => c.compound_id !== compound_id);
        const newRows = items.map((i: any) => ({ compound_id, ingredient_id: i.ingredient_id, quantity: i.quantity }));
        return [...filtered, ...newRows];
      });
      // Auto-update compound ingredient cost if computed
      if (computedCost > 0) {
        setIngredients(prev => prev.map(i => i.id === compound_id ? { ...i, cost_per_unit: computedCost } : i));
      }
      setMsg('✅ Receita composta salva!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setSavingCompoundRecipe(false); }
  }

  async function handleStockMovement(ingredient_id: any, isCompound = false) {
    if (!stockMovement.quantity) { alert('Quantidade é obrigatória'); return; }
    if (isCompound && !stockMovement.reason?.trim()) { alert('Justificativa é obrigatória para compostos'); return; }
    if (isCompound && !stockMovement.admin_password?.trim()) { alert('Senha do admin é obrigatória para compostos'); return; }
    setSavingStockMovement(true);
    try {
      const movType = isCompound ? 'adjustment' : stockMovement.type;
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'stock_movement', data: {
        ingredient_id,
        movement_type: movType,
        quantity: parseFloat(stockMovement.quantity),
        reason: stockMovement.reason,
        notes: stockMovement.notes,
        ...(isCompound ? { admin_password: stockMovement.admin_password } : {}),
      } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      // Update local ingredient stock
      setIngredients(prev => prev.map(i => i.id === ingredient_id ? { ...i, current_stock: d.new_stock } : i));
      setStockMovement({ type: 'in', quantity: '', reason: '', notes: '', admin_password: '' });
      setStockPanelIngId(null);
      setMsg('✅ Estoque atualizado!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setSavingStockMovement(false); }
  }

  async function handleDuplicateDrink(idx: any) {
    const drink = drinks[idx];
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'duplicate_drink', data: { id: drink.id } }),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.drink) {
        setDrinks(prev => [...prev, d.drink]);
        setExpandedDrinkId(d.drink.id);
      }
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  async function handleAddProduct() {
    if (!newProduct.name.trim() || !newProduct.price) { alert('Nome e preço são obrigatórios'); return; }
    setAddingProduct(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'add_product', data: {
          name: newProduct.name.trim(),
          category: newProduct.category,
          price: parseFloat(newProduct.price),
          description: newProduct.description || null,
          is_active: true, is_hidden: false,
          sort_order: products.length + 1,
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.product) {
        setProducts(prev => [...prev, d.product]);
        setExpandedId(d.product.id);
      }
      setNewProduct({ name: '', category: 'pizza', price: '', description: '' });
      setShowNewProduct(false);
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setAddingProduct(false); }
  }

  async function handleDuplicateProduct(idx: any) {
    const p = products[idx];
    setAddingProduct(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ action: 'add_product', data: {
          name: p.name + ' (cópia)',
          category: p.category || 'pizza',
          price: parseFloat(p.price) || 0,
          description: p.description || null,
          cost_price: parseFloat(p.cost_price) || null,
          image_url: p.image_url || null,
          is_active: false, is_hidden: false,
          sort_order: (p.sort_order || 0) + 1,
        }}),
      });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      if (d.product) {
        setProducts(prev => [...prev, d.product]);
        // Copy recipe if exists
        if (recipes[p.id]?.length > 0) {
          await handleSaveRecipe(d.product.id, recipes[p.id]);
        }
        setExpandedId(d.product.id);
      }
    } catch (e) { alert('Erro: ' + (e as Error).message); }
    finally { setAddingProduct(false); }
  }

  async function handleDeleteIngredient(id: any) {
    if (!confirm('Excluir este insumo? Isso removerá das fichas técnicas.')) return;
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'delete_ingredient', data: { id } }) });
      const d = await res.json();
      if (d.error) { alert('Erro: ' + d.error); return; }
      setIngredients((prev: any[]) => prev.filter((i: any) => i.id !== id));
      setRecipes((prev: any) => {
        const next = { ...prev };
        for (const pid of Object.keys(next)) next[pid] = next[pid].filter((r: any) => r.ingredient_id !== id);
        return next;
      });
    } catch (e) { alert('Erro: ' + (e as Error).message); }
  }

  // ── Recipes ───────────────────────────────────────────────────────────────────

  async function handleSaveRecipe(productId: any, items: any) {
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }, body: JSON.stringify({ action: 'save_recipe', data: { product_id: productId, items } }) });
    const d = await res.json();
    if (d.error) { alert('Erro ao salvar ficha: ' + d.error); throw new Error(d.error); }
    setRecipes((prev: any) => ({ ...prev, [productId]: items }));
  }

  // ── Filtered products ─────────────────────────────────────────────────────────

  const filteredProducts = products.filter(p => catFilter === 'all' || catFilter === 'bebidas' ? true : (p.category || 'pizza') === catFilter);
  const showDrinks = catFilter === 'all' || catFilter === 'bebidas';

  const imagePositions   = getImagePositions();
  const stockLimits      = getStockLimits();
  const drinkStockLimits = getDrinkStockLimits();

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: C.muted, fontSize: 14 }}>Carregando catálogo...</div>;
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
        {[
          { key: 'cardapio', icon: UtensilsCrossed, label: 'Cardápio' },
          { key: 'especial', icon: Star,            label: 'Especial do Mês' },
          { key: 'insumos',  icon: Package,         label: 'Insumos' },
          { key: 'analise',  icon: BarChart2,        label: 'Análise de Preço' },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '14px 18px',
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#111827' : C.muted,
              borderBottom: `2px solid ${tab === t.key ? '#F2A800' : 'transparent'}`,
              marginBottom: -1,
            }}>
              <Icon size={15} /> {t.label}
              {t.key === 'insumos' && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#F3F4F6', color: C.light, padding: '1px 6px', borderRadius: 9 }}>
                  {ingredients.length}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 13, fontWeight: 600, color: msg.startsWith('✅') ? '#059669' : '#EF4444', marginRight: 12 }}>{msg}</span>}
      </div>

      {/* ── ABA CARDÁPIO ─────────────────────────────────────────────────────── */}
      {tab === 'cardapio' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Category filter */}
          <div style={{ background: '#fff', borderBottom: '1px solid ' + C.border, padding: '10px 28px', display: 'flex', gap: 6, flexShrink: 0 }}>
            {FILTER_TABS.map(f => (
              <button key={f.key} onClick={() => setCatFilter(f.key)} style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: catFilter === f.key ? '#111827' : '#F3F4F6',
                color: catFilter === f.key ? '#fff' : C.muted,
              }}>{f.label}</button>
            ))}
          </div>

          <div style={{ padding: '24px 28px', paddingBottom: 80 }}>
            {/* Produtos */}
            {catFilter !== 'bebidas' && catFilter !== 'upsell' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <UtensilsCrossed size={16} color={C.gold} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Produtos ({filteredProducts.length})</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setShowNewProduct(v => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
                    border: 'none', background: showNewProduct ? '#F3F4F6' : '#111827',
                    color: showNewProduct ? C.muted : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    <Plus size={13} /> Novo Produto
                  </button>
                </div>

                {/* Formulário novo produto */}
                {showNewProduct && (
                  <div style={{ background: '#FFFBEB', borderRadius: 8, border: '1px dashed #F2A800', padding: 16, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 12 }}>Novo Produto</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Nome *</label>
                        <input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Pizza de Frango"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Categoria</label>
                        <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#fff', color: C.text }}>
                          {PROD_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Preço (R$) *</label>
                        <input type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} placeholder="0,00"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                    </div>
                    <input value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Descrição (opcional)"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text, marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddProduct} disabled={addingProduct} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: addingProduct ? '#9CA3AF' : C.gold, color: '#000', fontSize: 13, fontWeight: 700, cursor: addingProduct ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {addingProduct ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        {addingProduct ? 'Criando...' : 'Criar Produto'}
                      </button>
                      <button onClick={() => setShowNewProduct(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Blur backdrop when a product is being edited */}
                {expandedId !== null && (
                  <div
                    onClick={() => setExpandedId(null)}
                    style={{
                      position: 'fixed', inset: 0, zIndex: 1000,
                      backdropFilter: 'blur(3px)',
                      WebkitBackdropFilter: 'blur(3px)',
                      background: 'rgba(0,0,0,0.2)',
                    }}
                  />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {filteredProducts.map((p) => {
                    const productIdx = products.findIndex(prod => String(prod.id) === String(p.id));
                    if (productIdx < 0) return null;

                    return (
                    <ProductRow
                      key={p.id}
                      product={p} idx={productIdx}
                      isExpanded={expandedId === p.id}
                      onToggleExpand={() => setExpandedId((prev: any) => prev === p.id ? null : p.id)}
                      onDuplicate={handleDuplicateProduct}
                      onDelete={handleDeleteProduct}
                      onUpdate={updateProduct}
                      onUploadImage={handleImageUpload}
                      uploadingId={uploadingId}
                      imagePositions={imagePositions}
                      onUpdateImagePos={updateImagePosition}
                      stockLimits={stockLimits}
                      onUpdateStockLimit={updateStockLimit}
                      ingredients={ingredients}
                      recipe={recipes[p.id] || []}
                      onSaveRecipe={handleSaveRecipe}
                      onSave={saveProduct}
                      onToggleFlag={toggleProductFlag}
                      savingProductId={savingProductId}
                    />
                    );
                  })}
                </div>
              </>
            )}

            {/* Bebidas */}
            {showDrinks && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <GlassWater size={16} color={C.gold} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Bebidas ({drinks.length})</span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setShowNewDrink(v => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6,
                    border: 'none', background: showNewDrink ? '#F3F4F6' : '#111827',
                    color: showNewDrink ? C.muted : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    <Plus size={13} /> Nova Bebida
                  </button>
                </div>

                {/* Formulário nova bebida */}
                {showNewDrink && (
                  <div style={{ background: '#EFF6FF', borderRadius: 8, border: '1px dashed #6366F1', padding: 16, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', marginBottom: 12 }}>Nova Bebida</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Nome/Marca *</label>
                        <input value={newDrink.name} onChange={e => setNewDrink(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Coca-Cola"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tamanho</label>
                        <input value={newDrink.size} onChange={e => setNewDrink(p => ({ ...p, size: e.target.value }))} placeholder="Ex: 600ml"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Preço (R$) *</label>
                        <input type="number" step="0.01" value={newDrink.price} onChange={e => setNewDrink(p => ({ ...p, price: e.target.value }))} placeholder="0,00"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleAddDrink} disabled={addingDrink} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: addingDrink ? '#9CA3AF' : '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: addingDrink ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {addingDrink ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                        {addingDrink ? 'Criando...' : 'Criar Bebida'}
                      </button>
                      <button onClick={() => setShowNewDrink(false)} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {drinks.map((d, idx) => (
                    <DrinkRow
                      key={d.id}
                      drink={d} idx={idx}
                      isExpanded={expandedDrinkId === d.id}
                      onToggleExpand={() => setExpandedDrinkId((prev: any) => prev === d.id ? null : d.id)}
                      onDuplicate={handleDuplicateDrink}
                      onUpdate={updateDrink}
                      onDelete={handleDeleteDrink}
                      drinkStockLimits={drinkStockLimits}
                      onUpdateDrinkStockLimit={updateDrinkStockLimit}
                      onToggleFlag={toggleDrinkFlag}
                      onSave={saveDrink}
                      isSaving={savingDrinkId === d.id}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── UPSELL TAB ── */}
            {catFilter === 'upsell' && (() => {
              const allItems = [
                ...products.filter(p => p.is_active).map(p => ({ id: p.id, label: p.name, price: p.price, image_url: p.image_url, type: 'product' })),
                ...drinks.filter(d => d.is_active).map(d => ({ id: d.id, label: `${d.name}${d.size ? ` ${d.size}` : ''}`, price: d.price, image_url: null, type: 'drink' })),
              ];
              return (
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <TrendingUp size={16} color={C.gold} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Upsell no Carrinho</span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>— ofertas exibidas na gaveta do carrinho</span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => {
                        const next = [...upsellSlots, blankUpsell()];
                        setUpsellSlots(next);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid ' + C.gold, background: 'rgba(242,168,0,0.08)', color: C.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Plus size={13} /> Adicionar Upsell
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {upsellSlots.map((upsell, idx) => {
                      const selectedItem = upsell.product_id != null ? (allItems.find(i => String(i.id) === String(upsell.product_id)) || null) : null;
                      const isSavingSlot = savingUpsellSlotIdx === idx;
                      return (
                        <div key={idx} style={{ background: C.card, borderRadius: 10, border: '1px solid ' + (upsell.enabled ? C.gold : C.border), padding: 16 }}>
                          {/* Slot header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, background: upsell.enabled ? C.gold : C.border, color: upsell.enabled ? '#000' : C.muted, borderRadius: 6, padding: '2px 8px' }}>
                              Upsell {idx + 1}
                            </span>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: upsell.enabled ? C.success : C.muted }}>
                              <input
                                type="checkbox"
                                checked={!!upsell.enabled}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, enabled: e.target.checked } : u);
                                  setUpsellSlots(next);
                                }}
                                style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                              />
                              {upsell.enabled ? 'Ativo' : 'Inativo'}
                            </label>
                            <div style={{ flex: 1 }} />
                            <button
                              onClick={() => {
                                const next = upsellSlots.filter((_, i) => i !== idx);
                                saveUpsellConfig(next, null);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: C.danger }}
                            >
                              <Trash2 size={11} /> Remover
                            </button>
                          </div>

                          {/* Produto */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              Produto a oferecer
                            </label>
                            <select
                              value={upsell.product_id != null ? String(upsell.product_id) : ''}
                              onChange={e => {
                                const next = upsellSlots.map((u, i) => i === idx ? { ...u, product_id: e.target.value || null } : u);
                                setUpsellSlots(next);
                              }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', background: '#fff', color: C.text }}
                            >
                              <option value="">Selecionar produto ou bebida...</option>
                              <optgroup label="Produtos">
                                {products.filter(p => p.is_active).map(p => (
                                  <option key={p.id} value={p.id}>{p.name} — R$ {fmtBRL(p.price)}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Bebidas">
                                {drinks.filter(d => d.is_active).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}{d.size ? ` ${d.size}` : ''} — R$ {fmtBRL(d.price)}</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          {/* Texto + Preço */}
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                Texto da oferta
                              </label>
                              <input
                                value={upsell.offer_label}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, offer_label: e.target.value } : u);
                                  setUpsellSlots(next);
                                }}
                                placeholder="Ex: Aproveite e adicione:"
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                Preço especial (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={upsell.custom_price ?? ''}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, custom_price: e.target.value ? parseFloat(e.target.value) : null } : u);
                                  setUpsellSlots(next);
                                }}
                                placeholder={selectedItem ? fmtBRL(selectedItem.price).replace('R$\u00a0', '') : '0,00'}
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                              <p style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>Vazio = preço original</p>
                            </div>
                          </div>

                          {/* Foto personalizada — upload */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                              Foto personalizada
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <label
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 6, border: '1px solid ' + C.border, background: '#fff', fontSize: 12, fontWeight: 600, cursor: uploadingUpsellIdx === idx ? 'not-allowed' : 'pointer', color: C.text, opacity: uploadingUpsellIdx === idx ? 0.6 : 1, pointerEvents: uploadingUpsellIdx === idx ? 'none' : 'auto' }}
                              >
                                {uploadingUpsellIdx === idx
                                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Enviando...</>
                                  : <><Upload size={12} /> Fazer upload</>}
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleUpsellImageUpload(idx, e.target.files[0]); e.target.value = ''; }} disabled={uploadingUpsellIdx === idx} />
                              </label>
                              {upsell.custom_image_url ? (
                                <>
                                  <img src={upsell.custom_image_url} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid ' + C.border, flexShrink: 0 }} />
                                  <button
                                    onClick={() => { const next = upsellSlots.map((u, i) => i === idx ? { ...u, custom_image_url: null } : u); setUpsellSlots(next); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: C.danger }}
                                  >
                                    <Trash2 size={11} /> Remover foto
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: 11, color: C.muted }}>Sem foto — usará a foto do produto</span>
                              )}
                            </div>
                          </div>

                          {/* Mostrar foto */}
                          <div style={{ marginBottom: selectedItem ? 14 : 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontWeight: 500 }}>
                              <input
                                type="checkbox"
                                checked={!!upsell.show_image}
                                onChange={e => {
                                  const next = upsellSlots.map((u, i) => i === idx ? { ...u, show_image: e.target.checked } : u);
                                  setUpsellSlots(next);
                                }}
                                style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                              />
                              Mostrar foto no carrinho
                            </label>
                          </div>

                          {/* Preview */}
                          {selectedItem && (
                            <div style={{ background: '#F8F9FA', borderRadius: 8, padding: 12, border: '1px solid ' + C.border, marginBottom: 12 }}>
                              <p style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Prévia</p>
                              <div style={{ background: 'rgba(242,168,0,0.06)', border: '1px solid rgba(242,168,0,0.25)', borderRadius: 10, padding: 10 }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: C.gold, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                                  ✦ {upsell.offer_label || 'Aproveite e adicione:'}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {upsell.show_image && (upsell.custom_image_url || selectedItem.image_url) && (
                                    <img src={upsell.custom_image_url || selectedItem.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{selectedItem.label}</p>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>
                                      {fmtBRL(upsell.custom_price && upsell.custom_price > 0 ? upsell.custom_price : selectedItem.price)}
                                    </p>
                                    <div style={{ marginTop: 4, background: C.gold, color: '#000', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 800 }}>
                                      + Adicionar
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Botão Salvar individual */}
                          <button
                            onClick={() => saveUpsellConfig(upsellSlots, idx)}
                            disabled={isSavingSlot}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 6, border: 'none', background: isSavingSlot ? '#9CA3AF' : '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: isSavingSlot ? 'not-allowed' : 'pointer' }}
                          >
                            {isSavingSlot ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Save size={13} /> Salvar Upsell {idx + 1}</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {upsellSlots.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 13 }}>
                      Nenhum upsell configurado. Clique em "Adicionar Upsell" para criar.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── ABA INSUMOS ──────────────────────────────────────────────────────── */}
      {tab === 'insumos' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', position: 'relative' }}>
          {/* Blur backdrop when any ingredient panel is open */}
          {(stockPanelIngId || compoundPanelIngId || editingIng || selectedIngForHistory) && (
            <div
              onClick={() => { setStockPanelIngId(null); setCompoundPanelIngId(null); setEditingIng(null); setSelectedIngForHistory(null); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 50, cursor: 'pointer' }}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 13, color: C.muted }}>
              Insumos são matérias-primas utilizadas nas fichas técnicas dos produtos para calcular custo e margem automaticamente.
            </p>
            <button
              onClick={() => setShowNewIngModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: C.gold, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              <Plus size={14} /> Novo Insumo
            </button>
          </div>

          {/* Lista de ingredientes */}
          <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden', marginBottom: 20 }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 100px 180px', gap: 0, background: '#F9FAFB', borderBottom: '1px solid ' + C.border, padding: '10px 16px' }}>
              {['Insumo', 'Unidade', 'Custo/Unid.', 'Variação', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
              ))}
            </div>

            {ingredients.length === 0 ? (
              <p style={{ padding: 20, fontSize: 13, color: C.light, textAlign: 'center' }}>Nenhum insumo cadastrado. Adicione abaixo.</p>
            ) : (
              ingredients.map(ing => {
                const isEditing = editingIng === ing.id;
                const isStockOpen = stockPanelIngId === ing.id;
                const isCompoundOpen = compoundPanelIngId === ing.id;
                // Price variation % from first recorded history to current
                const history = priceHistory
                  .filter((h: any) => h.ingredient_id === ing.id)
                  .sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
                const firstPrice = history.length > 0 ? (parseFloat((history[0] as any).old_price) || parseFloat((history[0] as any).new_price)) : null;
                const currentPrice = parseFloat(ing.cost_per_unit);
                const variation = firstPrice && firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice * 100) : null;

                // Stock status
                const curStock = parseFloat(ing.current_stock) || 0;
                const minStock = parseFloat(ing.min_stock) || 0;
                const maxStock = parseFloat(ing.max_stock) || 0;
                const stockConfigured = minStock > 0 || maxStock > 0;
                const stockColor = !stockConfigured ? C.light : curStock <= minStock ? C.danger : C.success;

                // Compound items for this ingredient
                const ingCompoundItems = compoundItems.filter(c => c.compound_id === ing.id);

                // Is compound type
                const isCompound = ing.ingredient_type === 'compound';

                const hasAnyPanelOpen = isStockOpen || isCompoundOpen || selectedIngForHistory === ing.id;

                // Border color per active mode
                const activeBorderColor = isEditing ? '#111827' : isStockOpen ? '#10B981' : isCompoundOpen ? '#7C3AED' : selectedIngForHistory === ing.id ? '#2563EB' : null;

                return (
                  <div key={ing.id} style={activeBorderColor ? {
                    border: `2px solid ${activeBorderColor}`,
                    borderRadius: 8,
                    margin: '4px 8px',
                    boxShadow: `0 0 0 3px ${activeBorderColor}22`,
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 51,
                  } : {}}>
                    {/* Main row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 100px 180px', gap: 0, borderBottom: (hasAnyPanelOpen || isEditing) ? '1px solid ' + (activeBorderColor ? activeBorderColor + '40' : C.border) : '1px solid ' + C.border, padding: '10px 16px', alignItems: 'center', background: activeBorderColor ? activeBorderColor + '08' : 'transparent' }}>
                      {isEditing ? (
                        /* ── EDIT MODE ── */
                        <div style={{
                          gridColumn: '1 / -1',
                          background: isCompound ? '#F5F3FF' : '#F0F9FF',
                          borderRadius: 10,
                          padding: '16px 18px',
                          border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`,
                        }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: isCompound ? '#7C3AED' : '#0369A1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {isCompound ? '⬡ Insumo Composto' : '● Insumo Simples'}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: isCompound ? '#6D28D9' : '#0284C7' }}>— {ing.name}</span>
                          </div>

                          {/* Seção: Identificação */}
                          <p style={{ fontSize: 10, fontWeight: 700, color: isCompound ? '#7C3AED' : '#0369A1', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Identificação</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 90px 140px', gap: 8, marginBottom: 14 }}>
                            <input
                              value={ing.name}
                              onChange={e => handleUpdateIngredient(ing.id, 'name', e.target.value)}
                              placeholder="Nome"
                              style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, fontSize: 13, outline: 'none', background: '#fff', color: C.text }}
                            />
                            <select
                              value={ing.unit}
                              onChange={e => handleUpdateIngredient(ing.id, 'unit', e.target.value)}
                              style={{ padding: '7px 8px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, fontSize: 12, outline: 'none', background: '#fff', color: C.text }}
                            >
                              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            {isCompound ? (
                              /* Custo do composto é somente leitura — calculado pela receita */
                              <div style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #C4B5FD', background: '#EDE9FE', textAlign: 'right' }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#7C3AED', display: 'block' }}>{fmtBRL(parseFloat(ing.cost_per_unit) || 0)}</span>
                                <span style={{ fontSize: 9, color: '#9CA3AF', display: 'block', marginTop: 2 }}>🔒 calculado pela receita</span>
                              </div>
                            ) : (
                              <input
                                type="number"
                                value={ing.cost_per_unit}
                                min="0"
                                step="0.0001"
                                onChange={e => handleUpdateIngredient(ing.id, 'cost_per_unit', e.target.value)}
                                placeholder="Custo/unid"
                                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #7DD3FC', fontSize: 13, outline: 'none', textAlign: 'right', background: '#fff', color: C.text }}
                              />
                            )}
                          </div>

                          {/* Densidade — visível somente para unidades líquidas */}
                          {LIQUID_UNITS.includes(ing.unit) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#E0F2FE', borderRadius: 7, padding: '8px 12px', marginBottom: 14, border: '1px solid #7DD3FC' }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', whiteSpace: 'nowrap' }}>💧 Densidade (g/ml)</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="ex: 1.00"
                                value={ing.density ?? ''}
                                onChange={e => handleUpdateIngredient(ing.id, 'density', e.target.value)}
                                style={{ width: 90, padding: '5px 8px', borderRadius: 5, border: '1px solid #7DD3FC', fontSize: 12, outline: 'none', background: '#fff', color: C.text }}
                              />
                              <span style={{ fontSize: 10, color: '#0369A1' }}>Água = 1,00 · Óleo ≈ 0,92 · Leite ≈ 1,03</span>
                            </div>
                          )}

                          {/* Seção: Configuração */}
                          <p style={{ fontSize: 10, fontWeight: 700, color: isCompound ? '#7C3AED' : '#0369A1', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Configuração</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tipo</label>
                              <select
                                value={ing.ingredient_type || 'simple'}
                                onChange={e => handleUpdateIngredient(ing.id, 'ingredient_type', e.target.value)}
                                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, fontSize: 12, outline: 'none', background: '#fff', color: C.text }}
                              >
                                <option value="simple">Simples</option>
                                <option value="compound">Composto</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>FC — Fator de Correção (%)</label>
                              <input
                                type="number"
                                value={ing.correction_factor ?? ''}
                                min="0"
                                max="99.99"
                                step="0.01"
                                onChange={e => handleUpdateIngredient(ing.id, 'correction_factor', e.target.value)}
                                placeholder="0.00"
                                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                              {parseFloat(ing.correction_factor) > 0 && (
                                <>
                                  <span style={{ fontSize: 10, color: '#059669', fontWeight: 700, display: 'block', marginTop: 3 }}>
                                    Com FC: {fmtBRL(costWithFC(parseFloat(ing.cost_per_unit) || 0, ing.correction_factor))}/{ing.unit}
                                  </span>
                                  <span style={{ fontSize: 9, color: '#DC2626', display: 'block', marginTop: 1 }}>
                                    Base: {fmtBRL(parseFloat(ing.cost_per_unit) || 0)}/{ing.unit}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Seção: Estoque */}
                          <p style={{ fontSize: 10, fontWeight: 700, color: isCompound ? '#7C3AED' : '#0369A1', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>Estoque & Origem</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8, marginBottom: 14 }}>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Estoque Mín.</label>
                              <input
                                type="number"
                                value={ing.min_stock || ''}
                                min="0"
                                step="0.001"
                                onChange={e => handleUpdateIngredient(ing.id, 'min_stock', e.target.value)}
                                placeholder="0"
                                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Estoque Máx.</label>
                              <input
                                type="number"
                                value={ing.max_stock || ''}
                                min="0"
                                step="0.001"
                                onChange={e => handleUpdateIngredient(ing.id, 'max_stock', e.target.value)}
                                placeholder="0"
                                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Origem de Compra</label>
                              <input
                                value={ing.purchase_origin || ''}
                                onChange={e => handleUpdateIngredient(ing.id, 'purchase_origin', e.target.value)}
                                placeholder="Fornecedor / loja"
                                style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#fff', color: C.text }}
                              />
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => handleSaveIngredient(ing)}
                              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: isCompound ? '#7C3AED' : '#0369A1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                              <Check size={13} /> Salvar
                            </button>
                            <button
                              onClick={() => setEditingIng(null)}
                              style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${isCompound ? '#C4B5FD' : '#7DD3FC'}`, background: '#fff', color: C.text, fontSize: 12, cursor: 'pointer' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── VIEW MODE ── */
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ing.name}</span>
                              {isCompound ? (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Layers size={9} /> Composto
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: '#F3F4F6', color: C.muted }}>Simples</span>
                              )}
                              <span style={{ fontSize: 10, color: C.muted }}>FC: {formatCorrectionPercent(ing.correction_factor)}%</span>
                            </div>
                            {stockConfigured && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Warehouse size={10} color={stockColor} />
                                <span style={{ fontSize: 10, color: stockColor, fontWeight: 600 }}>
                                  {curStock.toFixed(2)} {ing.unit}
                                  {minStock > 0 && <span style={{ color: C.light }}> / mín {minStock}</span>}
                                </span>
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: C.muted }}>{ing.unit}</span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', display: 'block' }}>{fmtBRL(costWithFC(parseFloat(ing.cost_per_unit) || 0, ing.correction_factor))}</span>
                            {parseCorrectionLoss(ing.correction_factor) > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', display: 'block' }}>
                                Valor sem FC: {fmtBRL(parseFloat(ing.cost_per_unit) || 0)}/{ing.unit}
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            {variation !== null ? (
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                                background: variation > 0 ? '#FEF2F2' : variation < 0 ? '#ECFDF5' : '#F3F4F6',
                                color: variation > 0 ? C.danger : variation < 0 ? '#059669' : C.muted,
                              }}>
                                {variation > 0 ? '▲' : variation < 0 ? '▼' : '—'} {Math.abs(variation).toFixed(1)}%
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: C.light }}>—</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => { setStockPanelIngId(isStockOpen ? null : ing.id); setCompoundPanelIngId(null); setSelectedIngForHistory(null); setStockMovement({ type: 'in', quantity: '', reason: '', notes: '' }); }}
                              title="Gerenciar estoque"
                              style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid ' + C.border, background: isStockOpen ? '#ECFDF5' : '#fff', fontSize: 11, cursor: 'pointer', color: isStockOpen ? C.success : C.muted, display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                              <ArrowDownUp size={11} /> Estoque
                            </button>
                            {isCompound && (
                              <button
                                onClick={() => { setCompoundPanelIngId(isCompoundOpen ? null : ing.id); setStockPanelIngId(null); setSelectedIngForHistory(null); }}
                                title="Receita do composto"
                                style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid ' + C.border, background: isCompoundOpen ? '#EDE9FE' : '#fff', fontSize: 11, cursor: 'pointer', color: isCompoundOpen ? '#7C3AED' : C.muted, display: 'flex', alignItems: 'center', gap: 3 }}
                              >
                                <Layers size={11} /> Receita
                              </button>
                            )}
                            <button
                              onClick={() => { setSelectedIngForHistory(selectedIngForHistory === ing.id ? null : ing.id); setStockPanelIngId(null); setCompoundPanelIngId(null); }}
                              title="Histórico de preço"
                              style={{ padding: '4px 7px', borderRadius: 4, border: '1px solid ' + C.border, background: selectedIngForHistory === ing.id ? '#EFF6FF' : '#fff', fontSize: 11, cursor: 'pointer', color: selectedIngForHistory === ing.id ? '#2563EB' : C.muted, display: 'flex', alignItems: 'center' }}
                            >
                              <BarChart2 size={13} />
                            </button>
                            <button onClick={() => { setEditingIng(ing.id); setStockPanelIngId(null); setCompoundPanelIngId(null); setSelectedIngForHistory(null); }} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid ' + C.border, background: '#fff', fontSize: 11, cursor: 'pointer', color: C.muted }}>Editar</button>
                            <button onClick={() => handleDeleteIngredient(ing.id)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', fontSize: 11, cursor: 'pointer', color: C.danger }}>✕</button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* ── Stock movement panel ── */}
                    {isStockOpen && !isEditing && (
                      <div style={{ borderBottom: '1px solid ' + C.border, background: '#F0FDF4', padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Warehouse size={13} color={C.success} /> Estoque — {ing.name}
                          </p>
                          <button onClick={() => setStockPanelIngId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, lineHeight: 1 }}>×</button>
                        </div>
                        {/* Stock status */}
                        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                          <div style={{ background: stockConfigured ? (curStock <= minStock ? '#FEF2F2' : '#ECFDF5') : '#F3F4F6', borderRadius: 6, padding: '8px 14px', flex: 1, minWidth: 90 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 2 }}>ESTOQUE ATUAL</p>
                            <p style={{ fontSize: 16, fontWeight: 800, color: stockColor }}>{curStock.toFixed(3)} {ing.unit}</p>
                          </div>
                          {stockConfigured && (
                            <>
                              <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 14px', flex: 1, minWidth: 90 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 2 }}>MÍNIMO</p>
                                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{minStock.toFixed(3)} {ing.unit}</p>
                              </div>
                              <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 14px', flex: 1, minWidth: 90 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 2 }}>MÁXIMO</p>
                                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{maxStock.toFixed(3)} {ing.unit}</p>
                              </div>
                            </>
                          )}
                        </div>
                        {/* Mini stock history chart */}
                        {(() => {
                          const mvs = ingMovements[ing.id];
                          if (!mvs || mvs.length === 0) return null;
                          const maxQty = Math.max(...mvs.map((m: any) => Math.abs(parseFloat(m.quantity) || 0)), 0.001);
                          return (
                            <div style={{ marginBottom: 12 }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>Histórico de movimentações (últimas {mvs.length})</p>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48, background: '#F9FAFB', borderRadius: 6, padding: '6px 8px', overflow: 'hidden' }}>
                                {mvs.map((m: any, idx: any) => {
                                  const qty = Math.abs(parseFloat(m.quantity) || 0);
                                  const pct = qty / maxQty;
                                  const color = m.movement_type === 'in' ? '#10B981' : m.movement_type === 'out' ? '#EF4444' : '#F59E0B';
                                  return (
                                    <div key={m.id || idx} title={`${m.movement_type}: ${qty} ${ing.unit}\n${m.reason || ''}`} style={{ flex: 1, minWidth: 4, background: color, borderRadius: 2, height: Math.max(4, pct * 36) + 'px', alignSelf: 'flex-end', opacity: 0.85, cursor: 'default', transition: 'height 0.2s' }} />
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                {[['#10B981', 'Entrada'], ['#EF4444', 'Saída'], ['#F59E0B', 'Ajuste']].map(([color, label]) => (
                                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.muted }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />{label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Movement form */}
                        {isCompound && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 10px', background: '#FEF3C7', borderRadius: 6, border: '1px solid #FDE68A' }}>
                            <span style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>
                              Compostos: somente ajuste de estoque. Requer justificativa e senha do admin.
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: isCompound ? '100px 1fr' : '120px 100px 1fr', gap: 8, marginBottom: 8 }}>
                          {!isCompound && (
                            <div>
                              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tipo</label>
                              <select value={stockMovement.type} onChange={e => setStockMovement((p: any) => ({ ...p, type: e.target.value }))} style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#fff' }}>
                                <option value="in">Entrada</option>
                                <option value="out">Saída</option>
                                <option value="adjustment">Ajuste</option>
                              </select>
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                              {isCompound ? 'Novo Estoque' : 'Quantidade'}
                            </label>
                            <input type="number" min="0" step="0.001" value={stockMovement.quantity} onChange={e => setStockMovement((p: any) => ({ ...p, quantity: e.target.value }))} placeholder="0.000" style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                              {isCompound ? 'Justificativa *' : 'Motivo'}
                            </label>
                            <input value={stockMovement.reason} onChange={e => setStockMovement((p: any) => ({ ...p, reason: e.target.value }))} placeholder={isCompound ? 'Motivo do ajuste (obrigatório)...' : 'Compra, perda, inventário...'} style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        {isCompound ? (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Senha do Admin *</label>
                            <input type="password" value={stockMovement.admin_password || ''} onChange={e => setStockMovement((p: any) => ({ ...p, admin_password: e.target.value }))} placeholder="Digite a senha do admin..." style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        ) : (
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Observações</label>
                            <input value={stockMovement.notes} onChange={e => setStockMovement((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Observações opcionais..." style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        )}
                        <button
                          onClick={() => handleStockMovement(ing.id, isCompound)}
                          disabled={savingStockMovement}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 5, border: 'none', background: savingStockMovement ? '#9CA3AF' : C.success, color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingStockMovement ? 'not-allowed' : 'pointer' }}
                        >
                          {savingStockMovement ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                          {savingStockMovement ? 'Salvando...' : 'Registrar Movimentação'}
                        </button>
                      </div>
                    )}

                    {/* ── Compound recipe panel ── */}
                    {isCompoundOpen && !isEditing && (
                      <CompoundRecipePanel
                        ingredient={ing}
                        ingredients={ingredients}
                        adminToken={adminToken}
                        onClose={() => setCompoundPanelIngId(null)}
                        onIngredientCreated={(newIng: any) => setIngredients((prev: any[]) => [...prev, newIng].sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR')))}
                        onRecipeApplied={(ingId: any, newStock: any) => setIngredients((prev: any[]) => prev.map((i: any) => i.id === ingId ? { ...i, current_stock: newStock } : i))}
                      />
                    )}

                    {/* ── Inline price history panel ── */}
                    {selectedIngForHistory === ing.id && !isEditing && (() => {
                      const chartPoints = [];
                      if (history.length > 0) {
                        const beforeFirst = new Date(history[0].changed_at);
                        beforeFirst.setDate(beforeFirst.getDate() - 1);
                        chartPoints.push({ date: beforeFirst.toISOString(), price: parseFloat(history[0].old_price) || 0 });
                        for (const h of history) chartPoints.push({ date: h.changed_at, price: parseFloat(h.new_price) });
                      }
                      chartPoints.push({ date: new Date().toISOString(), price: parseFloat(ing.cost_per_unit) || 0, isCurrent: true });
                      return (
                        <div style={{ borderBottom: '1px solid ' + C.border, background: '#F8FAFC', padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Histórico de preço — {ing.name}</p>
                            <button onClick={() => setSelectedIngForHistory(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 16, lineHeight: 1 }}>×</button>
                          </div>
                          {chartPoints.length < 2 ? (
                            <p style={{ fontSize: 12, color: C.light, padding: '8px 0' }}>Sem histórico. Altere o custo para começar a registrar.</p>
                          ) : (
                            <>
                              <PriceLineChart points={chartPoints} />
                              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 100, overflowY: 'auto' }}>
                                {[...history].reverse().map((h, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
                                    <span>{new Date(h.changed_at).toLocaleDateString('pt-BR')}</span>
                                    <span>{fmtBRL(h.old_price)} → <strong style={{ color: parseFloat(h.new_price) > parseFloat(h.old_price) ? C.danger : '#059669' }}>{fmtBRL(h.new_price)}</strong></span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal: Novo Insumo */}
          {showNewIngModal && (
            <div
              onClick={e => { if (e.target === e.currentTarget) setShowNewIngModal(false); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            >
              <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ color: C.gold, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, margin: 0 }}>
                    <Plus size={18} color={C.gold} /> Novo Insumo
                  </h3>
                  <button onClick={() => setShowNewIngModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Nome do insumo *</label>
                    <input className="input-field" placeholder="ex: Farinha de trigo" value={newIng.name} onChange={e => setNewIng(p => ({ ...p, name: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Unidade</label>
                    <select value={newIng.unit} onChange={e => {
                      const u = e.target.value;
                      setNewIng(p => ({ ...p, unit: u, density: LIQUID_UNITS.includes(u) ? p.density : '' }));
                      if (LIQUID_UNITS.includes(u)) setDensityPrompt({ target: 'new', pendingUnit: u, value: newIng.density });
                    }} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#F9FAFB', color: C.text }}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {LIQUID_UNITS.includes(newIng.unit) && (
                      <p style={{ fontSize: 10, color: '#0369A1', marginTop: 3, fontWeight: 600 }}>
                        Densidade: {newIng.density ? `${newIng.density} g/ml` : <span style={{ color: '#DC2626' }}>não informada</span>}
                        {' '}<button onClick={() => setDensityPrompt({ target: 'new', pendingUnit: newIng.unit, value: newIng.density })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369A1', fontSize: 10, textDecoration: 'underline', padding: 0 }}>editar</button>
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Custo por unid. (R$)</label>
                    <input className="input-field" type="number" min="0" step="0.0001" placeholder="0,00" value={newIng.cost_per_unit} onChange={e => setNewIng(p => ({ ...p, cost_per_unit: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Tipo</label>
                    <select value={newIng.ingredient_type} onChange={e => setNewIng(p => ({ ...p, ingredient_type: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + C.border, fontSize: 12, outline: 'none', background: '#F9FAFB', color: C.text }}>
                      <option value="simple">Simples</option>
                      <option value="compound">Composto</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Perda / FC (%)</label>
                    <input className="input-field" type="number" min="0" max="99.99" step="0.01" placeholder="0.00" value={newIng.correction_factor} onChange={e => setNewIng(p => ({ ...p, correction_factor: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Estoque Mínimo</label>
                    <input className="input-field" type="number" min="0" step="0.001" placeholder="0" value={newIng.min_stock} onChange={e => setNewIng(p => ({ ...p, min_stock: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Estoque Máximo</label>
                    <input className="input-field" type="number" min="0" step="0.001" placeholder="0" value={newIng.max_stock} onChange={e => setNewIng(p => ({ ...p, max_stock: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 3 }}>Origem de Compra</label>
                    <input className="input-field" placeholder="Fornecedor / loja" value={newIng.purchase_origin} onChange={e => setNewIng(p => ({ ...p, purchase_origin: e.target.value }))} style={{ background: '#F9FAFB', color: C.text, borderColor: C.border }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleAddIngredient} disabled={addingIng} style={{ padding: '10px 20px', background: C.gold, color: '#000', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: addingIng ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {addingIng ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                    {addingIng ? 'Adicionando...' : 'Adicionar Insumo'}
                  </button>
                  <button onClick={() => setShowNewIngModal(false)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid ' + C.border, background: '#fff', color: C.text, fontSize: 13, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA ESPECIAL DO MÊS ──────────────────────────────────────────────── */}
      {tab === 'especial' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Star size={20} color={C.gold} />
            <p style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Especial do Mês</p>
          </div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
            Configure o sabor especial que aparece como destaque no cardápio. Esse conteúdo é exibido automaticamente no site.
          </p>

          {/* Toggle ativo/inativo */}
          {(() => {
            const enabled = getSetting('special_flavor_enabled') !== 'false';
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: '14px 20px', maxWidth: 600, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Exibir no cardápio</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                    {enabled ? 'O especial do mês está visível para os clientes.' : 'O especial do mês está oculto do cardápio.'}
                  </p>
                </div>
                <button
                  onClick={() => saveSetting('special_flavor_enabled', enabled ? 'false' : 'true')}
                  style={{
                    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: enabled ? C.gold : '#D1D5DB',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: enabled ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            );
          })()}

          <div style={{ background: C.card, borderRadius: 12, border: '1px solid ' + C.border, padding: 24, maxWidth: 600, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: 'rgba(242,168,0,0.08)', borderRadius: 8, border: '1px solid rgba(242,168,0,0.2)' }}>
              <Star size={14} color={C.gold} />
              <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                Este sabor substitui automaticamente a descrição do produto "Especial do Mês" no cardápio.
              </span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Nome do Sabor *
              </label>
              <input
                className="input-field"
                placeholder="ex: Quatro Queijos Trufada"
                value={getSetting('special_flavor_name')}
                onChange={e => setSetting('special_flavor_name', e.target.value)}
                style={{ background: '#F9FAFB', color: C.text, borderColor: C.border, fontSize: 14 }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Descrição
              </label>
              <textarea
                className="input-field"
                placeholder="Descreva os ingredientes, diferenciais do sabor..."
                value={getSetting('special_flavor_description')}
                onChange={e => setSetting('special_flavor_description', e.target.value)}
                rows={4}
                style={{ resize: 'vertical', background: '#F9FAFB', color: C.text, borderColor: C.border, fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>

            <SpecialFlavorSaveButton
              name={getSetting('special_flavor_name')}
              description={getSetting('special_flavor_description')}
              onSave={saveSetting}
            />

            {/* Preview */}
            {getSetting('special_flavor_name') && (
              <div style={{ marginTop: 20, padding: 16, background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Prévia do Cardápio</p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,#F2A800,#EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Star size={18} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>
                      Especial do Mês — {getSetting('special_flavor_name')}
                    </p>
                    {getSetting('special_flavor_description') && (
                      <p style={{ fontSize: 12, color: C.muted }}>{getSetting('special_flavor_description')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA ANÁLISE DE PREÇO ─────────────────────────────────────────────── */}
      {tab === 'analise' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 6 }}>Análise de Preço</p>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
            Variação histórica de custo dos insumos. Os preços são registrados automaticamente ao salvar um insumo com novo valor.
          </p>

          {ingredients.length === 0 ? (
            <p style={{ fontSize: 13, color: C.light, textAlign: 'center', padding: 40 }}>Nenhum insumo cadastrado.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
              {ingredients.map((ing: any) => {
                const history = priceHistory
                  .filter((h: any) => h.ingredient_id === ing.id)
                  .sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());

                // Build chart points: initial old_price → each change → current
                const chartPoints = [];
                if (history.length > 0) {
                  // Starting price: old_price of the first recorded change (one day before)
                  const beforeFirst = new Date(history[0].changed_at);
                  beforeFirst.setDate(beforeFirst.getDate() - 1);
                  chartPoints.push({ date: beforeFirst.toISOString(), price: parseFloat(history[0].old_price) || 0 });
                  for (const h of history) {
                    chartPoints.push({ date: h.changed_at, price: parseFloat(h.new_price) });
                  }
                }
                chartPoints.push({ date: new Date().toISOString(), price: parseFloat(ing.cost_per_unit) || 0, isCurrent: true });
                const points = chartPoints;

                return (
                  <div key={ing.id} style={{ background: C.card, borderRadius: 10, border: '1px solid ' + C.border, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ing.name}</p>
                        <p style={{ fontSize: 11, color: C.muted }}>{ing.unit} · Atual: {fmtBRL(ing.cost_per_unit)}</p>
                      </div>
                      {history.length > 0 && (() => {
                        const first = parseFloat(history[0].old_price) || parseFloat(history[0].new_price);
                        const current = parseFloat(ing.cost_per_unit);
                        const pct = first > 0 ? ((current - first) / first * 100) : 0;
                        return (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: pct > 0 ? '#FEF2F2' : '#ECFDF5', color: pct > 0 ? C.danger : C.success }}>
                            {pct > 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>

                    {points.length < 2 ? (
                      <p style={{ fontSize: 12, color: C.light, textAlign: 'center', padding: '16px 0' }}>
                        Sem histórico de variação. Altere o custo do insumo para começar a registrar.
                      </p>
                    ) : (
                      <PriceLineChart points={points} />
                    )}

                    {history.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: 10, color: C.light, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Histórico</p>
                        <div style={{ maxHeight: 100, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {[...history].reverse().map((h, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted }}>
                              <span>{new Date(h.changed_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                              <span>{fmtBRL(h.old_price)} → <strong style={{ color: C.text }}>{fmtBRL(h.new_price)}</strong></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>

    {/* ── Density popup ──────────────────────────────────────────────────────── */}
    {densityPrompt !== null && (
      <div
        onClick={e => { if (e.target === e.currentTarget) setDensityPrompt(null); }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      >
        <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 380, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0369A1', marginBottom: 6 }}>💧 Densidade do líquido</h3>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
            Informe a densidade em <strong>g/ml</strong> para converter volume ↔ peso nas receitas.<br />
            Referências comuns: água = 1,00 · leite ≈ 1,03 · óleo vegetal ≈ 0,92 · mel ≈ 1,42
          </p>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 4 }}>Densidade (g/ml) *</label>
          <input
            autoFocus
            type="number"
            min="0.1"
            max="20"
            step="0.01"
            placeholder="ex: 1.00"
            value={densityPrompt.value}
            onChange={e => setDensityPrompt(p => p ? { ...p, value: e.target.value } : p)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const d = parseFloat(densityPrompt.value);
                if (!d || d <= 0) { alert('Informe uma densidade válida (> 0)'); return; }
                if (densityPrompt.target === 'new') {
                  setNewIng(p => ({ ...p, unit: densityPrompt.pendingUnit, density: densityPrompt.value }));
                } else {
                  setIngredients((prev: any[]) => prev.map((i: any) => i.id === densityPrompt.target ? { ...i, unit: densityPrompt.pendingUnit, density: d } : i));
                }
                setDensityPrompt(null);
              }
              if (e.key === 'Escape') setDensityPrompt(null);
            }}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid #7DD3FC', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: C.text, marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                const d = parseFloat(densityPrompt.value);
                if (!d || d <= 0) { alert('Informe uma densidade válida (> 0)'); return; }
                if (densityPrompt.target === 'new') {
                  setNewIng(p => ({ ...p, unit: densityPrompt.pendingUnit, density: densityPrompt.value }));
                } else {
                  setIngredients((prev: any[]) => prev.map((i: any) => i.id === densityPrompt.target ? { ...i, unit: densityPrompt.pendingUnit, density: d } : i));
                }
                setDensityPrompt(null);
              }}
              style={{ flex: 1, padding: '9px 0', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Confirmar
            </button>
            <button
              onClick={() => setDensityPrompt(null)}
              style={{ padding: '9px 16px', border: '1px solid ' + C.border, borderRadius: 7, background: '#fff', color: C.muted, fontSize: 13, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
