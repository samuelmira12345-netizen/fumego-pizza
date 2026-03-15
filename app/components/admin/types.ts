// Shared domain types for admin components

export interface AdminOrder {
  id: string | number;
  order_number?: string | number;
  status: string;
  payment_status?: string;
  payment_method?: string;
  customer_name: string;
  customer_phone?: string;
  created_at: string;
  scheduled_at?: string | null;
  delivery_type?: 'delivery' | 'pickup';
  delivery_street?: string;
  delivery_number?: string;
  delivery_neighborhood?: string;
  delivery_city?: string;
  delivery_zipcode?: string;
  subtotal?: number | string;
  delivery_fee?: number | string;
  discount?: number | string;
  total?: number | string;
  notes?: string;
  items?: AdminOrderItem[];
  delivery_person_id?: string | null;
}

export interface AdminOrderItem {
  id?: string | number;
  product_id?: string | number;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  total_price?: number | string;
  notes?: string;
  flavor_1?: string;
  flavor_2?: string;
}

export interface AdminProduct {
  id: string | number;
  name: string;
  description?: string;
  price: number | string;
  category?: string;
  is_active?: boolean;
  is_hidden?: boolean;
  image_url?: string;
  sizes?: AdminProductSize[];
}

export interface AdminProductSize {
  id?: string | number;
  size: string;
  price: number | string;
  is_active?: boolean;
}

export interface AdminDrink {
  id: string | number;
  name: string;
  price: number | string;
  is_active?: boolean;
  image_url?: string;
  stock_qty?: number | string;
}

export interface AdminIngredient {
  id: string | number;
  name: string;
  unit: string;
  cost_per_unit: number | string;
  stock_qty?: number | string;
  correction_factor?: number | string;
  min_stock?: number | string;
  max_stock?: number | string;
}

export interface RecipeItem {
  ingredient_id: string | number;
  quantity: number | string;
  recipe_unit?: string;
}

export interface StockLimits {
  ingredient_id: string | number;
  min_stock?: number | string;
  max_stock?: number | string;
}

export interface DeliveryPerson {
  id: string;
  name: string;
  phone?: string;
  is_active?: boolean;
  driver_location_lat?: string | null;
  driver_location_lng?: string | null;
  driver_location_at?: string | null;
}

export interface DeliveryRule {
  id?: string | number;
  radius_km: number | string;
  fee: number | string;
  estimated_mins: number | string;
  is_active?: boolean;
}
