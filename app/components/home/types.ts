// Tipos compartilhados entre os componentes da página principal

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  is_hidden: boolean;
  sort_order: number;
  promotion_active?: boolean;
  promotional_price?: number | string | null;
  promotion_ends_at?: string | null;
}

export interface Drink {
  id: string;
  name: string;
  price: number | string;
  size: string;
  is_active: boolean;
  is_hidden?: boolean;
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

export interface AppSettings {
  [key: string]: string;
}

export interface AppUser {
  name: string;
  email: string;
}

export interface StockLimit {
  enabled: boolean;
  qty: number;
  low_stock_threshold?: number;
}

export interface ImagePosition {
  x: number;
  y: number;
}
