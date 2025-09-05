jest.mock('next/server', () => ({
  __esModule: true,
  NextRequest: function () {},
  NextResponse: {
    json: (body: any, init?: any) => ({
      status: (init && init.status) || 200,
      headers: (init && init.headers) || {},
      json: async () => body,
    }),
  },
}));

import { POST } from './route';

jest.mock('@/lib/stripe', () => ({
  __esModule: true,
  createPaymentIntent: jest.fn(async (params: any) => ({
    id: 'pi_test_123',
    client_secret: 'pi_test_123_secret',
    amount: params.amount,
    currency: params.currency,
    status: 'requires_payment_method',
  })),
  handleStripeError: jest.fn((err: any) => ({
    category: err.type || 'unknown',
    isRetryable: false,
    userMessage: 'error',
    logData: {},
  })),
}));

jest.mock('@/lib/orderHelpers', () => ({
  __esModule: true,
  createOrder: jest.fn((_req: any) => ({
    order: {
      id: 'order_test_123',
      orderNumber: 'ORD-2024-001234',
      status: 'pending',
      paymentStatus: 'pending',
      currency: 'ron',
      items: [],
      totals: {
        subtotal: 0,
        discount: 0,
        shipping: 0,
        tax: 0,
        total: 2500,
        currency: 'ron',
      },
    },
  })),
  updateOrderPayment: jest.fn((order: any, params: any) => ({
    success: true,
    order: {
      ...order,
      paymentIntentId: params.paymentData.paymentIntentId,
      paymentIntentStatus: params.paymentData.paymentIntentStatus,
    },
  })),
}));

jest.mock('@/config/stripe', () => ({
  __esModule: true,
  getPaymentIntentParams: jest.fn((amount: number, orderId: string) => ({
    amount,
    currency: 'ron',
    automatic_payment_methods: { enabled: true },
    metadata: { orderId, environment: 'test', timestamp: '2024-01-01T00:00:00Z' },
  })),
  stripeConfig: { environmentLabel: 'test', isTestMode: true },
}));

const makeHeaders = (origin?: string) => new Headers({
  'content-type': 'application/json',
  'user-agent': `jest-test ${Date.now()}-${Math.random()}`,
  ...(origin ? { origin } : {}),
});

const makeRequest = (body: any, origin = 'http://localhost:3000') => ({
  headers: makeHeaders(origin),
  json: async () => body,
}) as any;

describe('Create Intent API - route POST', () => {
  const validBody = {
    customerInfo: { email: 'test@example.com', firstName: 'John', lastName: 'Doe' },
    shippingAddress: { fullName: 'John Doe', streetAddress: '1 St', city: 'City', postalCode: '00000', country: 'RO' },
    billingAddress: { fullName: 'John Doe', streetAddress: '1 St', city: 'City', postalCode: '00000', country: 'RO' },
    items: [ { id: 1, name: 'Item', price: { original: 25, currency: 'ron' }, quantity: 1, image: '' } ],
  };

  it('returns 200 for valid request with allowed origin', async () => {
    const req = makeRequest(validBody);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.paymentIntent?.id).toBeDefined();
  });

  it('blocks disallowed origin with 403', async () => {
    const req = makeRequest(validBody, 'https://evil.example');
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('returns 400 INVALID_JSON on parse error', async () => {
    const req = { headers: makeHeaders('http://localhost:3000'), json: async () => { throw new Error('bad'); } } as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('INVALID_JSON');
  });

  it('returns 400 VALIDATION_ERROR when body invalid', async () => {
    const badBody = { ...validBody, items: [] };
    const req = makeRequest(badBody);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 INVALID_AMOUNT for amount below min', async () => {
    const small = { ...validBody, items: [ { id: 1, name: 'Item', price: { original: 1, currency: 'ron' }, quantity: 1, image: '' } ] };
    const req = makeRequest(small);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe('INVALID_AMOUNT');
  });
});


