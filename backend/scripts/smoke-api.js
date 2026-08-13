const {
  analizarUrlBaseDatos,
  validarConfiguracionBasePruebas,
} = require('./test-database-safety.js');

function validarEntorno(env = process.env) {
  validarConfiguracionBasePruebas(env, { requerirDestructiva: true });

  const baseUrl = String(env.TEST_BASE_URL || '').trim();
  const adminUsername = String(env.TEST_ADMIN_USERNAME || '').trim();
  const adminPassword = String(env.TEST_ADMIN_PASSWORD || '');
  if (!baseUrl || !adminUsername || !adminPassword) {
    throw new Error('Se requieren TEST_BASE_URL, TEST_ADMIN_USERNAME y TEST_ADMIN_PASSWORD');
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), adminUsername, adminPassword };
}

async function request(baseUrl, path, options = {}, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${path}`);
  }
  return body;
}

async function ejecutarSmoke(env = process.env) {
  const { baseUrl, adminUsername, adminPassword } = validarEntorno(env);
  const prefijo = `qa_smoke_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  let tokenAdministrador = '';
  let usuarioCreadoId = null;
  let pedidoCreadoId = null;

  try {
    const sesionAdministrador = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: adminUsername, password: adminPassword }),
    });
    tokenAdministrador = String(sesionAdministrador?.token || '');
    if (!tokenAdministrador) throw new Error('El login de pruebas no devolvio JWT');

    const usuarioCreado = await request(baseUrl, '/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: prefijo,
        name: `QA Smoke ${prefijo}`,
        password: `Qa-${prefijo}-123!`,
        role: 'mesero',
        active: true,
      }),
    }, tokenAdministrador);
    usuarioCreadoId = Number(usuarioCreado?.id || 0) || null;
    if (!usuarioCreadoId) throw new Error('No se obtuvo el id del usuario temporal');

    const sesionTemporal = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: prefijo, password: `Qa-${prefijo}-123!` }),
    });
    const tokenTemporal = String(sesionTemporal?.token || '');
    if (!tokenTemporal) throw new Error('El usuario temporal no obtuvo JWT');

    const pedidoCreado = await request(baseUrl, '/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        status: 'pending',
        customerName: prefijo,
        items: [{ productId: 900001, name: prefijo, quantity: 1, price: 1, subtotal: 1 }],
      }),
    }, tokenTemporal);
    pedidoCreadoId = Number(pedidoCreado?.id || 0) || null;
    if (!pedidoCreadoId) throw new Error('No se obtuvo el id del pedido temporal');

    const pedidoConsultado = await request(baseUrl, `/api/orders/${pedidoCreadoId}`, {}, tokenTemporal);
    if (Number(pedidoConsultado?.id) !== pedidoCreadoId) {
      throw new Error('La consulta no devolvio el pedido temporal');
    }

    console.log('SMOKE_OK');
    console.log(JSON.stringify({ login: true, usuarioTemporal: true, pedidoTemporal: true }));
  } finally {
    if (pedidoCreadoId && tokenAdministrador) {
      try {
        await request(baseUrl, `/api/orders/${pedidoCreadoId}`, { method: 'DELETE' }, tokenAdministrador);
      } catch {
        console.warn(`No se pudo limpiar el pedido temporal ${pedidoCreadoId}`);
      }
    }
    if (usuarioCreadoId && tokenAdministrador) {
      try {
        await request(baseUrl, `/api/users/${usuarioCreadoId}`, { method: 'DELETE' }, tokenAdministrador);
      } catch {
        console.warn(`No se pudo limpiar el usuario temporal ${usuarioCreadoId}`);
      }
    }
  }
}

if (require.main === module) {
  ejecutarSmoke().catch(error => {
    console.error('SMOKE_FAIL');
    console.error(error instanceof Error ? error.message : 'Error desconocido');
    process.exitCode = 1;
  });
}

module.exports = {
  nombreBaseDatos: url => {
    try {
      return analizarUrlBaseDatos(url).nombreBaseDatos.toLowerCase();
    } catch {
      return '';
    }
  },
  validarEntorno,
  ejecutarSmoke,
};
