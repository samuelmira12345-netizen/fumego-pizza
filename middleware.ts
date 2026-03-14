// middleware.ts — sem regras ativas no momento.
// Este arquivo é mantido para futura utilização de middleware global.
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest): void {}

export const config = { matcher: [] };
