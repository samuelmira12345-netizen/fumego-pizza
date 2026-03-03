// Tipos compartilhados entre os componentes da página principal

export interface Product {
  id: number;
  slug: string;
  name: string;
  price: number | string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Drink {
  id: number;
  name: string;
  price: number | string;
  size: string;
  is_active: boolean;
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
