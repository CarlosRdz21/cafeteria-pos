"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
const requiredVariables = ['DATABASE_URL', 'JWT_SECRET'];
const allowedNodeEnvironments = new Set(['development', 'production', 'test']);
function assertValidUrl(name, value, allowedProtocols) {
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new Error(`Variable de entorno inválida: ${name}`);
    }
    if (!allowedProtocols.includes(parsed.protocol)) {
        throw new Error(`Variable de entorno inválida: ${name}`);
    }
}
function validateEnvironment(environment = process.env) {
    for (const name of requiredVariables) {
        if (!environment[name]?.trim()) {
            throw new Error(`Falta variable de entorno obligatoria: ${name}`);
        }
    }
    assertValidUrl('DATABASE_URL', environment.DATABASE_URL, ['mysql:']);
    const databaseUrl = new URL(environment.DATABASE_URL);
    const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
    if (databaseName === 'cafeteria_pos_prod_clone'
        && environment.CLONE_READ_ONLY !== 'true') {
        throw new Error('cafeteria_pos_prod_clone sólo puede iniciar con CLONE_READ_ONLY=true');
    }
    if (environment.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET debe contener al menos 32 caracteres');
    }
    const nodeEnvironment = environment.NODE_ENV?.trim() || 'development';
    if (!allowedNodeEnvironments.has(nodeEnvironment)) {
        throw new Error('Variable de entorno inválida: NODE_ENV');
    }
    if (environment.PORT) {
        const port = Number(environment.PORT);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('Variable de entorno inválida: PORT');
        }
    }
    if (environment.JWT_EXPIRES_IN && !/^\d+(?:ms|s|m|h|d|w|y)?$/.test(environment.JWT_EXPIRES_IN)) {
        throw new Error('Variable de entorno inválida: JWT_EXPIRES_IN');
    }
    if (environment.JSON_BODY_LIMIT && !/^\d+(?:b|kb|mb|gb)$/i.test(environment.JSON_BODY_LIMIT)) {
        throw new Error('Variable de entorno inválida: JSON_BODY_LIMIT');
    }
    for (const name of ['LOGIN_RATE_LIMIT_WINDOW_MS', 'LOGIN_RATE_LIMIT_MAX']) {
        if (environment[name] && (!/^\d+$/.test(environment[name]) || Number(environment[name]) < 1)) {
            throw new Error(`Variable de entorno inválida: ${name}`);
        }
    }
    for (const name of ['FRONTEND_ORIGINS', 'SOCKET_ORIGINS']) {
        const origins = (environment[name] || '')
            .split(',')
            .map(origin => origin.trim())
            .filter(Boolean);
        for (const origin of origins) {
            if (origin === '*')
                throw new Error(`${name} no permite el comodín *`);
            assertValidUrl(name, origin, ['http:', 'https:', 'capacitor:']);
        }
    }
    for (const name of ['MP_SUCCESS_URL', 'MP_PENDING_URL', 'MP_FAILURE_URL']) {
        const value = environment[name]?.trim();
        if (value)
            assertValidUrl(name, value, ['http:', 'https:']);
    }
}
