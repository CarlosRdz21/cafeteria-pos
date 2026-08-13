import type { RequestHandler, Response } from 'express';

type Body = Record<string, unknown>;

const roles = new Set(['admin', 'barista', 'mesero', 'waiter']);

function isBody(value: unknown): value is Body {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function invalid(res: Response, message: string) {
  return res.status(400).json({ error: message });
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isPositiveInteger(value: unknown): boolean {
  if (
    typeof value !== 'number'
    && (typeof value !== 'string' || value.trim().length === 0)
  ) {
    return false;
  }
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isFiniteNumber(value: unknown, minimum = 0): boolean {
  if (
    typeof value !== 'number'
    && (typeof value !== 'string' || value.trim().length === 0)
  ) {
    return false;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum;
}

export const validateLogin: RequestHandler = (req, res, next) => {
  if (!isBody(req.body)) return invalid(res, 'Invalid request body');
  const username = req.body.username ?? req.body.email;
  if (!isNonEmptyString(username, 100) || !isNonEmptyString(req.body.password, 200)) {
    return invalid(res, 'Username and password required');
  }
  next();
};

export const validateCreateUser: RequestHandler = (req, res, next) => {
  if (!isBody(req.body)) return invalid(res, 'Invalid request body');
  if (!isNonEmptyString(req.body.username, 100) || req.body.username.trim().length < 3) {
    return invalid(res, 'Invalid username');
  }
  if (!isNonEmptyString(req.body.name, 150)) return invalid(res, 'Invalid name');
  if (!isNonEmptyString(req.body.password, 200) || req.body.password.length < 8) {
    return invalid(res, 'Password must contain at least 8 characters');
  }
  if (!roles.has(String(req.body.role || ''))) return invalid(res, 'Invalid role');
  if (req.body.active !== undefined && typeof req.body.active !== 'boolean') {
    return invalid(res, 'Invalid active value');
  }
  next();
};

export const validateUpdateUser: RequestHandler = (req, res, next) => {
  if (!isBody(req.body)) return invalid(res, 'Invalid request body');
  if (req.body.username !== undefined && !isNonEmptyString(req.body.username, 100)) {
    return invalid(res, 'Invalid username');
  }
  if (req.body.name !== undefined && !isNonEmptyString(req.body.name, 150)) {
    return invalid(res, 'Invalid name');
  }
  if (
    req.body.password !== undefined &&
    (typeof req.body.password !== 'string' || (req.body.password.length > 0 && req.body.password.length < 8) || req.body.password.length > 200)
  ) {
    return invalid(res, 'Invalid password');
  }
  if (req.body.role !== undefined && !roles.has(String(req.body.role))) {
    return invalid(res, 'Invalid role');
  }
  if (req.body.active !== undefined && typeof req.body.active !== 'boolean') {
    return invalid(res, 'Invalid active value');
  }
  next();
};

export const validateCreateOrder: RequestHandler = (req, res, next) => {
  if (!isBody(req.body) || !Array.isArray(req.body.items) || req.body.items.length === 0 || req.body.items.length > 200) {
    return invalid(res, 'Invalid order items');
  }

  for (const item of req.body.items) {
    if (
      !isBody(item) ||
      !isPositiveInteger(item.productId) ||
      !isNonEmptyString(item.name, 200) ||
      !isPositiveInteger(item.quantity) ||
      !isFiniteNumber(item.price) ||
      !isFiniteNumber(item.subtotal)
    ) {
      return invalid(res, 'Invalid order item');
    }
  }

  if (req.body.status !== undefined && req.body.status !== 'pending' && req.body.status !== 'completed') {
    return invalid(res, 'Invalid order status');
  }
  if (req.body.paymentMethod !== undefined && req.body.paymentMethod !== 'cash' && req.body.paymentMethod !== 'card') {
    return invalid(res, 'Invalid payment method');
  }
  if (req.body.amountPaid !== undefined && !isFiniteNumber(req.body.amountPaid)) {
    return invalid(res, 'Invalid amountPaid');
  }
  next();
};

export const validateCreatePayment: RequestHandler = (req, res, next) => {
  if (!isBody(req.body) || !isPositiveInteger(req.body.orderId)) {
    return invalid(res, 'Invalid orderId');
  }
  if (req.body.method !== 'cash' && req.body.method !== 'card') {
    return invalid(res, 'Invalid payment method');
  }
  if (req.body.amount !== undefined && !isFiniteNumber(req.body.amount)) {
    return invalid(res, 'Invalid amount');
  }
  next();
};
