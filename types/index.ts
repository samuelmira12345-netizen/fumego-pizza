/**
 * types/index.ts — Interfaces de domínio centrais do sistema.
 *
 * Estas interfaces representam as entidades do banco de dados Supabase e são
 * compartilhadas entre API routes, admin-actions e componentes React.
 *
 * Convenção:
 *  - Campos nullable do DB são tipados como `string | null` (não `undefined`)
 *  - Campos opcionais nas requisições usam `?` (pode ser undefined em runtime)
 *  - Enums literais substituem `string` onde os valores são fixos e conhecidos
 */

// ── Enums de domínio ──────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'scheduled'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'approved' | 'refunded' | 'failed';

export type PaymentMethod =
  | 'pix'
  | 'card'
  | 'card_credit'
  | 'card_debit'
  | 'debit'
  | 'cash'
  | 'card_delivery'
  | 'voucher';

// ── Pedidos ───────────────────────────────────────────────────────────────────

export interface Order {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;

  // Endereço de entrega
  delivery_street: string | null;
  delivery_number: string | null;
  delivery_complement: string | null;
  delivery_neighborhood: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_zipcode: string | null;

  // Financeiro
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  cashback_used: number;
  cashback_earned: number;
  coupon_code: string | null;

  // Pagamento
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  fiscal_note: string | null;
  cash_received: number | null;
  payment_notes: string | null;

  // Status e lifecycle
  status: OrderStatus;
  is_active: boolean;
  observations: string | null;
  scheduled_for: string | null;
  /** Prazo exibido ao cliente no checkout, ex: "40–60 min". Usado para comparação histórica. */
  promised_delivery_time: string | null;

  // Timestamps
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  delivering_at: string | null;
  delivered_at: string | null;

  // Campos internos / rastreabilidade
  customer_cpf: string | null;
  idempotency_key: string | null;
  stock_conflict: boolean;

  // Relacionamentos
  user_id: string | null;
  delivery_person_id: string | null;
  driver_collected_at: string | null;
  driver_delivered_at: string | null;
  delivery_sort_order: number | null;

  // Join opcional (carregado junto em algumas queries)
  order_items?: OrderItem[];
}

export interface OrderItem {
  id?: string;
  order_id: string;
  product_id: string | null;
  drink_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  observations: string | null;
  created_at?: string;
}

export interface OrderChangeHistory {
  id: string;
  order_id: string;
  action_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number | string;
  image_url: string | null;
  is_active: boolean;
  is_hidden: boolean;
  sort_order: number;
  category?: string | null;
  promotion_active?: boolean;
  promotional_price?: number | string | null;
  promotion_ends_at?: string | null;
  stock_limit?: string | null; // JSON serializado
}

export interface Drink {
  id: number;
  name: string;
  price: number | string;
  size: string;
  is_active: boolean;
  is_hidden?: boolean;
  sort_order?: number;
  promotion_active?: boolean;
  promotional_price?: number | string | null;
  promotion_ends_at?: string | null;
}

export interface DrinkSelection extends Drink {
  quantity: number;
}

export interface CartItemOption {
  label: string;
  extra_price: number;
}

export interface CartItem {
  id: number;
  product: Product;
  observations: string;
  drinks: DrinkSelection[];
  option?: CartItemOption | null;
  option2?: CartItemOption | null;
}

// ── Cupons ────────────────────────────────────────────────────────────────────

export type CouponType = 'percent' | 'fixed' | 'free_delivery';

export interface Coupon {
  id: string;
  code: string;
  name: string | null;
  discount_type: CouponType;
  discount_percent: number;
  discount_fixed: number;
  is_free_delivery: boolean;
  valid_until: string | null;
  usage_limit: number | null;
  times_used: number;
  is_first_order_only: boolean;
  is_active: boolean;
  min_order_value: number | null;
  max_uses_per_cpf: number | null;
  new_customers_only: boolean;
  available_days: unknown | null;
  payment_methods: unknown | null;
  created_at: string;
}

// ── Clientes ──────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf_hash: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zipcode: string | null;
  cashback_balance: number;
  created_at: string;
}

// ── Entregadores ──────────────────────────────────────────────────────────────

export interface DeliveryPerson {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  polygon: unknown; // GeoJSON
  created_at: string;
}

// ── Configurações ─────────────────────────────────────────────────────────────

export interface Setting {
  key: string;
  value: string;
}

/** Map de chave→valor extraído do array de Settings */
export type SettingsMap = Record<string, string>;

// ── Ingredientes / Estoque ────────────────────────────────────────────────────

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number | null;
  cost_per_unit: number | null;
  created_at: string;
}

export interface StockMovement {
  id: string;
  ingredient_id: string;
  movement_type: 'entrada' | 'saida' | 'sale' | 'adjustment';
  quantity: number;
  reason: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
}

// ── Respostas da API admin ────────────────────────────────────────────────────

export interface AdminApiRequest<T = Record<string, unknown>> {
  action: string;
  data?: T;
}

export interface ApiSuccessResponse {
  success: true;
}

export interface ApiErrorResponse {
  error: string;
}

export type ApiResponse<T = Record<string, unknown>> =
  | (T & { success?: true })
  | ApiErrorResponse;
