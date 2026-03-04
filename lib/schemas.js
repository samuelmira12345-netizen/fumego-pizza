/**
 * lib/schemas.js — Schemas Zod compartilhados entre as API routes.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email:    z.string().email('E-mail inválido').max(254),
  password: z.string().min(1, 'Senha obrigatória').max(128),
});

export const registerSchema = z.object({
  name:     z.string().min(2, 'Nome muito curto').max(100).trim(),
  email:    z.string().email('E-mail inválido').max(254),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(128),
  phone:    z.string().max(20).optional().nullable(),
  address_street:       z.string().max(200).optional().nullable(),
  address_number:       z.string().max(20).optional().nullable(),
  address_complement:   z.string().max(100).optional().nullable(),
  address_neighborhood: z.string().max(100).optional().nullable(),
  address_city:         z.string().max(100).optional().nullable(),
  address_state:        z.string().max(2).optional().nullable(),
  address_zipcode:      z.string().max(10).optional().nullable(),
});

export const createOrderSchema = z.object({
  orderPayload: z.object({
    customer_name:         z.string().min(2).max(100).trim(),
    customer_phone:        z.string().min(8).max(20),
    customer_email:        z.string().email().max(254).optional().nullable(),
    delivery_street:       z.string().min(2).max(200).trim(),
    delivery_number:       z.string().min(1).max(20),
    delivery_neighborhood: z.string().min(2).max(100).trim(),
    delivery_complement:   z.string().max(100).optional().nullable(),
    delivery_city:         z.string().max(100).optional().nullable(),
    delivery_state:        z.string().max(2).optional().nullable(),
    delivery_zipcode:      z.string().max(10).optional().nullable(),
    subtotal:              z.number().nonnegative(),
    delivery_fee:          z.number().nonnegative(),
    discount:              z.number().nonnegative(),
    total:                 z.number().positive('Total deve ser positivo'),
    payment_method:        z.enum(['pix', 'card', 'cash', 'card_delivery']),
    payment_status:        z.string().optional(),
    status:                z.string().optional(),
    coupon_code:           z.string().max(50).optional().nullable(),
    observations:          z.string().max(500).optional().nullable(),
    user_id:               z.string().uuid().optional().nullable(),
    scheduled_for:         z.string().datetime().optional().nullable(),
    cashback_used:         z.number().nonnegative().optional().default(0),
  }),
  items: z.array(z.object({
    product_id:   z.string().uuid().optional().nullable(),
    drink_id:     z.string().uuid().optional().nullable(),
    product_name: z.string().min(1).max(200),
    quantity:     z.number().int().positive(),
    unit_price:   z.number().nonnegative(),
    total_price:  z.number().nonnegative(),
    observations: z.string().max(500).optional().nullable(),
  })).min(1, 'Pedido deve ter pelo menos 1 item'),
  coupon: z.any().optional().nullable(),
  cpf:    z.string().max(14).optional().nullable(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('E-mail inválido').max(254),
});

export const resetPasswordSchema = z.object({
  token:        z.string().min(1),
  new_password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres').max(128),
});
