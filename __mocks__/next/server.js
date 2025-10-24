/**
 * Jest mock for next/server
 * Provides compatible polyfills for NextRequest and NextResponse
 * Handles both node and jsdom environments
 */

// Ensure Request is available globally
if (typeof globalThis.Request === 'undefined') {
  // Try to use Node.js native fetch if available (Node 18+)
  if (typeof global.Request !== 'undefined') {
    globalThis.Request = global.Request;
  } else {
    // Fallback to a minimal Request implementation
    class MinimalRequest {
      constructor(input, init = {}) {
        this.url = typeof input === 'string' ? input : input.url;
        this.method = init.method || 'GET';
        this.headers = new Map(Object.entries(init.headers || {}));
        this.body = init.body;
      }
      
      async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
      }
      
      async json() {
        const text = await this.text();
        return JSON.parse(text);
      }
    }
    globalThis.Request = MinimalRequest;
  }
}

// Similarly for Response
if (typeof globalThis.Response === 'undefined') {
  if (typeof global.Response !== 'undefined') {
    globalThis.Response = global.Response;
  } else {
    class MinimalResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.statusText = init.statusText || 'OK';
        this.headers = new Map(Object.entries(init.headers || {}));
      }
      
      async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
      }
      
      async json() {
        const text = await this.text();
        return JSON.parse(text);
      }
    }
    globalThis.Response = MinimalResponse;
  }
}

// Now create the mock classes
class MockNextRequest extends globalThis.Request {
  constructor(input, init = {}) {
    super(input, init);
    
    // Add NextRequest-specific properties
    this.ip = '127.0.0.1';
    this.geo = { country: 'US', city: 'San Francisco' };
    
    // Create nextUrl object
    const url = new URL(typeof input === 'string' ? input : input.url);
    this.nextUrl = {
      pathname: url.pathname,
      search: url.search,
      searchParams: url.searchParams,
      origin: url.origin,
      href: url.href,
      protocol: url.protocol,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      toString: () => url.toString()
    };
    
    // Add cookies mock
    this.cookies = {
      get: () => undefined,
      getAll: () => [],
      has: () => false,
      set: () => {},
      delete: () => {},
      clear: () => {}
    };
  }
  
  // Override json() method to ensure proper parsing
  async json() {
    try {
      const text = await this.text();
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Failed to parse JSON from request body');
    }
  }
}

// Mock NextResponse
class MockNextResponse extends globalThis.Response {
  constructor(body, init) {
    super(body, init);
  }
  
  static json(object, init = {}) {
    return new MockNextResponse(JSON.stringify(object), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers
      }
    });
  }
  
  static redirect(url, status = 302) {
    return new MockNextResponse(null, {
      status,
      headers: {
        location: typeof url === 'string' ? url : url.toString()
      }
    });
  }
  
  static rewrite(url) {
    return new MockNextResponse(null, {
      headers: {
        'x-middleware-rewrite': typeof url === 'string' ? url : url.toString()
      }
    });
  }
  
  static next() {
    return new MockNextResponse(null, {
      headers: {
        'x-middleware-next': '1'
      }
    });
  }
}

module.exports = {
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
  userAgent: () => ({ isBot: false, ua: 'test-agent' }),
  userAgentFromString: () => ({ isBot: false, ua: 'test-agent' })
};