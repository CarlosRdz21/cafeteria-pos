import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loginRateLimiter,
  resetLoginRateLimiter,
  securityHeaders,
} from '../src/middlewares/security.middleware';

function createResponse() {
  const response = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe('endurecimiento HTTP', () => {
  beforeEach(() => {
    resetLoginRateLimiter();
    process.env.LOGIN_RATE_LIMIT_MAX = '2';
    process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';
  });

  afterEach(() => {
    delete process.env.LOGIN_RATE_LIMIT_MAX;
    delete process.env.LOGIN_RATE_LIMIT_WINDOW_MS;
  });

  it('agrega cabeceras defensivas', () => {
    const response = createResponse();
    const next = vi.fn();

    securityHeaders({} as Request, response as unknown as Response, next as NextFunction);

    expect(response.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(response.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
    expect(next).toHaveBeenCalledOnce();
  });

  it('limita intentos repetidos de login por dirección', () => {
    const request = { ip: '127.0.0.10', socket: {} } as Request;
    const next = vi.fn();

    loginRateLimiter(request, createResponse() as unknown as Response, next as NextFunction);
    loginRateLimiter(request, createResponse() as unknown as Response, next as NextFunction);
    const blockedResponse = createResponse();
    loginRateLimiter(request, blockedResponse as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith({ error: 'Too many login attempts' });
    expect(blockedResponse.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });
});
