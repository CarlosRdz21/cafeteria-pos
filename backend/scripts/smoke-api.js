/* eslint-disable no-console */
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';
const cleanup = process.env.CLEANUP !== '0';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`HTTP ${response.status} ${response.statusText} on ${path}: ${detail}`);
  }

  return body;
}

async function main() {
  const stamp = Date.now();
  const username = `qa_${stamp}`;
  const password = 'Qa123456!';
  let createdUserId = null;

  try {
    const createdUser = await request('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username,
        name: 'QA Hostinger',
        password,
        role: 'admin',
        active: true,
      }),
    });
    createdUserId = createdUser.id;

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    const createdOrder = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        status: 'pending',
        items: [
          {
            productId: 900001,
            name: 'QA Cafe Americano',
            quantity: 2,
            price: 45,
            subtotal: 90,
          },
        ],
      }),
    });

    const fetchedOrder = await request(`/api/orders/${createdOrder.id}`);
    const pendingOrders = await request('/api/orders?status=pending');

    const summary = {
      baseUrl,
      createdUserId,
      createdUsername: createdUser.username,
      loginUserId: login.user?.id,
      tokenReceived: Boolean(login.token),
      createdOrderId: createdOrder.id,
      fetchedOrderStatus: fetchedOrder.status,
      pendingOrdersCount: Array.isArray(pendingOrders) ? pendingOrders.length : null,
    };

    console.log('SMOKE_OK');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (cleanup && createdUserId) {
      try {
        await request(`/api/users/${createdUserId}`, { method: 'DELETE' });
      } catch (error) {
        console.warn('Cleanup warning:', error instanceof Error ? error.message : String(error));
      }
    }
  }
}

main().catch((error) => {
  console.error('SMOKE_FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
