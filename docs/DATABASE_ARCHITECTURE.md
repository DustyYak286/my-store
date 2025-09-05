# Database Architecture for Production

This document outlines the database requirements and migration path for moving from the current in-memory order storage to a production-ready persistent database system.

## 🔄 How Database Integration Works with Payment Flow

### Complete Payment Flow with Database
Understanding how database calls integrate with the Stripe payment system:

#### 1. **Payment Intent Creation** (`POST /api/payments/create-intent`)
```
Frontend Request → Your API → Database & Stripe Flow:

1. Security & Validation (Your API)
   ├── Validate request origin (CORS protection)
   ├── Rate limiting checks
   ├── Input sanitization and validation
   └── Business rule validation

2. Database Operations (Your Server)
   ├── INSERT new order record (status: 'pending')
   ├── INSERT order items
   ├── Generate unique order number
   └── Return order ID for tracking

3. Stripe API Call (Your Server → Stripe)
   ├── Create Payment Intent with order metadata
   ├── Include order ID in metadata
   └── Receive client secret for frontend

4. Response to Frontend
   └── Return: client secret + order details
```

#### 2. **Frontend Payment Processing**
```
Frontend → Stripe (Direct):
├── Load Stripe Elements with client secret
├── User enters card details (goes directly to Stripe)
├── Stripe processes payment
└── Returns success/failure to frontend
```

#### 3. **Webhook Processing** (`POST /api/webhooks/stripe`)
```
Stripe → Your Webhook Handler → Database Updates:

1. Webhook Received
   ├── Verify webhook signature (security)
   ├── Parse event type (payment_intent.succeeded, etc.)
   └── Extract payment intent ID

2. Database Queries
   ├── SELECT order by payment_intent_id
   ├── INSERT payment event (audit trail)
   └── UPDATE order status based on event

3. Business Actions
   ├── Send confirmation email
   ├── Clear user's cart
   ├── Trigger fulfillment process
   └── Update inventory (if applicable)
```

### Database Call Patterns

#### **Order Creation (API Route)**
```typescript
// /api/payments/create-intent
async function createOrder(orderData) {
  // Start database transaction
  const transaction = await db.transaction();
  
  try {
    // 1. Create order record
    const order = await db.orders.create({
      data: {
        orderNumber: generateOrderNumber(),
        status: 'pending',
        paymentStatus: 'pending',
        customerEmail: orderData.customerInfo.email,
        total: calculateTotal(orderData.items),
        // ... other fields
      }
    });

    // 2. Create order items
    await db.orderItems.createMany({
      data: orderData.items.map(item => ({
        orderId: order.id,
        productId: item.id,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity
      }))
    });

    // 3. Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.total * 100, // Convert to cents
      currency: 'ron',
      metadata: { orderId: order.id }
    });

    // 4. Update order with payment intent ID
    await db.orders.update({
      where: { id: order.id },
      data: { paymentIntentId: paymentIntent.id }
    });

    await transaction.commit();
    return { order, paymentIntent };
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

#### **Webhook Processing (Database Updates)**
```typescript
// /api/webhooks/stripe
async function handlePaymentSucceeded(event) {
  const paymentIntentId = event.data.object.id;
  
  // Start transaction for data consistency
  const transaction = await db.transaction();
  
  try {
    // 1. Find order by payment intent ID
    const order = await db.orders.findUnique({
      where: { paymentIntentId },
      include: { items: true }
    });

    if (!order) {
      throw new Error(`Order not found for payment intent: ${paymentIntentId}`);
    }

    // 2. Record payment event (audit trail)
    await db.paymentEvents.create({
      data: {
        orderId: order.id,
        eventType: event.type,
        stripeEventId: event.id,
        paymentIntentId: paymentIntentId,
        eventStatus: 'succeeded',
        rawData: event,
        processedAt: new Date()
      }
    });

    // 3. Update order status
    await db.orders.update({
      where: { id: order.id },
      data: {
        status: 'confirmed',
        paymentStatus: 'succeeded',
        updatedAt: new Date()
      }
    });

    // 4. Record status change history
    await db.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: 'pending',
        toStatus: 'confirmed',
        changedBy: 'stripe-webhook',
        changeReason: 'Payment succeeded'
      }
    });

    await transaction.commit();
    
    // 5. Trigger post-payment actions
    await sendConfirmationEmail(order);
    await clearUserCart(order.customerEmail);
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### Key Database Integration Points

#### **Where Database Calls Happen:**

1. **Order Creation** (Payment Intent API)
   - `INSERT orders` - Create new order record
   - `INSERT order_items` - Store cart items
   - `UPDATE orders` - Add payment intent ID after Stripe call

2. **Payment Processing** (Webhooks)
   - `SELECT orders` - Find order by payment intent ID
   - `INSERT payment_events` - Log all payment events
   - `UPDATE orders` - Update payment and order status
   - `INSERT order_status_history` - Track status changes

3. **Order Management** (Admin/Customer)
   - `SELECT orders` - Order lookups and history
   - `UPDATE orders` - Status updates (shipping, etc.)
   - `SELECT order_items` - Order details display

#### **Data Consistency Guarantees:**

- **ACID Transactions**: Ensure order creation and payment processing are atomic
- **Foreign Key Constraints**: Maintain data integrity between orders and items
- **Unique Constraints**: Prevent duplicate orders or payment events
- **Event Deduplication**: Use Stripe event IDs to prevent duplicate processing

#### **Performance Considerations:**

- **Indexed Lookups**: Fast queries by payment intent ID, customer email, order number
- **Connection Pooling**: Efficient database connection management
- **Read Replicas**: Separate read/write workloads for better performance
- **Query Optimization**: Include related data in single queries to reduce round trips

### Benefits of Database Integration

#### **Data Persistence**
- Orders survive server restarts and deployments
- Complete audit trail of all payment events
- Historical data for business analytics

#### **Scalability**
- Multiple server instances can share same data
- Handle concurrent order processing safely
- Scale database independently from application

#### **Business Intelligence**
- Real-time reporting on sales and orders
- Customer behavior analysis
- Financial reconciliation with Stripe

#### **Operational Excellence**
- Order management dashboard for customer service
- Automated fulfillment workflows
- Inventory management integration

This database integration maintains your existing Stripe payment flow while adding the persistence and scalability needed for production e-commerce operations.

## 🗄️ Current vs. Production Setup

### Current State (Development Only)
- **Storage**: In-memory storage using `Map<string, Order>` in `src/lib/orderStore.ts`
- **Persistence**: Data disappears when server restarts
- **Scalability**: Single server instance only
- **Query Capabilities**: Limited to basic CRUD operations
- **Status**: ✅ Perfect for development and testing, ❌ Not production-ready

### Production Requirements
- **Persistent storage** that survives server restarts
- **Concurrent access** from multiple server instances
- **ACID transactions** for data integrity
- **Advanced querying** for reporting and analytics
- **Backup and recovery** capabilities
- **Scalability** for growing order volume

## 📋 Essential Database Schema

### 1. Orders Table (Primary)

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_intent_id VARCHAR(100),
    
    -- Customer Information
    customer_email VARCHAR(255) NOT NULL,
    customer_first_name VARCHAR(100) NOT NULL,
    customer_last_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(50),
    
    -- Shipping Address
    shipping_full_name VARCHAR(200) NOT NULL,
    shipping_street_address TEXT NOT NULL,
    shipping_city VARCHAR(100) NOT NULL,
    shipping_state VARCHAR(100),
    shipping_postal_code VARCHAR(20) NOT NULL,
    shipping_country VARCHAR(2) NOT NULL,
    
    -- Billing Address
    billing_full_name VARCHAR(200),
    billing_street_address TEXT,
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(2),
    
    -- Financial Information
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'ron',
    
    -- Metadata
    client_request_id VARCHAR(100),
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_payment_intent_id ON orders(payment_intent_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE UNIQUE INDEX idx_orders_order_number ON orders(order_number);
```

**Status Enum Values:**
- `pending` - Order created, payment not yet confirmed
- `confirmed` - Payment confirmed, order being processed
- `processing` - Order being prepared/manufactured
- `shipped` - Order shipped to customer
- `delivered` - Order delivered successfully
- `cancelled` - Order cancelled
- `returned` - Order returned by customer

**Payment Status Enum Values:**
- `pending` - Payment intent created, awaiting payment
- `processing` - Payment being processed by Stripe
- `succeeded` - Payment completed successfully
- `failed` - Payment failed
- `cancelled` - Payment cancelled
- `refunded` - Payment refunded (partial or full)

### 2. Order Items Table

```sql
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Product Information
    product_id INTEGER NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_image VARCHAR(500),
    
    -- Pricing
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Product snapshot (in case product details change)
    product_snapshot JSONB, -- Store product details at time of order
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

### 3. Payment Events Table (Audit Trail)

```sql
CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Event Information
    event_type VARCHAR(50) NOT NULL,
    stripe_event_id VARCHAR(100) UNIQUE NOT NULL,
    payment_intent_id VARCHAR(100),
    
    -- Event Data
    event_status VARCHAR(20) NOT NULL,
    raw_data JSONB NOT NULL, -- Full webhook payload
    processing_status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    
    -- Timestamps
    stripe_created_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance and deduplication
CREATE UNIQUE INDEX idx_payment_events_stripe_event_id ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_order_id ON payment_events(order_id);
CREATE INDEX idx_payment_events_payment_intent_id ON payment_events(payment_intent_id);
CREATE INDEX idx_payment_events_received_at ON payment_events(received_at);
```

**Event Types:**
- `payment_intent.created`
- `payment_intent.succeeded` 
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.dispute.created`
- `invoice.payment_succeeded` (for subscriptions)

### 4. Order Status History Table (Optional)

```sql
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Status Change
    from_status VARCHAR(20),
    to_status VARCHAR(20) NOT NULL,
    
    -- Change Information
    changed_by VARCHAR(100), -- 'system', 'webhook', user email, etc.
    change_reason TEXT,
    notes TEXT,
    
    -- Timestamp
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_changed_at ON order_status_history(changed_at);
```

## 🛠️ Recommended Database Technologies

### Primary Recommendation: PostgreSQL

**Why PostgreSQL:**
- ✅ **JSONB Support**: Perfect for storing flexible data like addresses, product snapshots
- ✅ **ACID Compliance**: Ensures data integrity for financial transactions
- ✅ **Advanced Indexing**: Excellent performance for complex queries
- ✅ **UUID Support**: Built-in UUID generation for secure IDs
- ✅ **Time Zone Support**: Critical for international e-commerce
- ✅ **Mature Ecosystem**: Excellent tooling and ORM support

**Hosting Options:**
- **Vercel Postgres** - Seamless integration with Next.js deployment
- **Supabase** - PostgreSQL with real-time features and dashboard
- **Railway** - Simple deployment with built-in PostgreSQL
- **AWS RDS** - Enterprise-grade with full AWS ecosystem
- **DigitalOcean Managed Databases** - Cost-effective with good performance

### ORM/Query Builder Recommendations

#### 1. Prisma (Recommended)
```typescript
// Example Prisma schema
model Order {
  id              String   @id @default(uuid())
  orderNumber     String   @unique
  status          OrderStatus
  paymentStatus   PaymentStatus
  customerEmail   String
  total           Decimal
  items           OrderItem[]
  paymentEvents   PaymentEvent[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Pros:**
- Type-safe database queries
- Excellent Next.js integration
- Built-in migrations
- Great developer experience

#### 2. Drizzle ORM
```typescript
// Example Drizzle schema
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
});
```

**Pros:**
- Lightweight and fast
- SQL-like syntax
- Good TypeScript support
- Less magic than Prisma

## 🔄 Migration Strategy

### Phase 1: Current State ✅
- **Status**: In-memory storage working perfectly
- **Integration Tests**: All passing with real Stripe API calls
- **Order Interface**: Well-designed and stable
- **Business Logic**: Complete and tested

### Phase 2: Database Integration (Pre-Production)

#### Step 1: Database Setup
1. Choose database provider (recommend Vercel Postgres for simplicity)
2. Set up database instance
3. Create database schema using migrations
4. Set up connection pooling

#### Step 2: Database Layer Implementation
1. **Replace `orderStore.ts`** with database repository pattern
2. **Create database models** matching current Order interface
3. **Implement repository methods**:
   ```typescript
   interface OrderRepository {
     create(order: Order): Promise<Order>
     findById(id: string): Promise<Order | null>
     update(id: string, updates: Partial<Order>): Promise<Order>
     findByPaymentIntentId(paymentIntentId: string): Promise<Order | null>
   }
   ```

#### Step 3: Update Integration Points
1. **API Routes**: Update to use database instead of memory store
2. **Webhook Handlers**: Store payment events in database
3. **Integration Tests**: Configure test database for isolated testing

#### Step 4: Migration Script
```typescript
// Migration script to move any existing data
async function migrateOrdersToDatabase() {
  const memoryOrders = getAllOrdersFromMemory();
  for (const order of memoryOrders) {
    await database.orders.create(order);
  }
}
```

### Phase 3: Production Ready Features

#### Enhanced Order Management
- Order search and filtering
- Bulk operations for admin
- Order export functionality
- Customer order history API

#### Reporting and Analytics
```sql
-- Example analytics queries
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as order_count,
  SUM(total) as daily_revenue
FROM orders 
WHERE status = 'confirmed' 
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

#### Data Retention and Archiving
- Archive old orders to reduce query performance impact
- Implement data retention policies
- Regular backup procedures

## 🔒 Security Considerations

### Database Security
- **Connection Encryption**: Always use SSL/TLS for database connections
- **Access Control**: Limit database access to application servers only
- **Environment Variables**: Store database credentials securely
- **SQL Injection Prevention**: Use parameterized queries (ORM handles this)

### Data Privacy
- **PCI Compliance**: Never store credit card details (Stripe handles this)
- **GDPR Compliance**: Implement data deletion for customer requests
- **Data Encryption**: Consider encrypting sensitive fields at rest

### Backup Strategy
- **Automated Backups**: Daily automated backups with point-in-time recovery
- **Backup Testing**: Regularly test backup restoration procedures
- **Geographic Distribution**: Store backups in multiple regions

## 📊 Performance Optimization

### Indexing Strategy
- **Primary Keys**: UUID indexes for fast lookups
- **Status Queries**: Index on order status for admin dashboards
- **Customer Queries**: Index on customer email for order history
- **Date Queries**: Index on created_at for reporting

### Query Optimization
```typescript
// Efficient order loading with items
const orderWithItems = await db.order.findUnique({
  where: { id: orderId },
  include: {
    items: true,
    paymentEvents: {
      orderBy: { createdAt: 'desc' },
      take: 10 // Latest events only
    }
  }
});
```

### Connection Management
- **Connection Pooling**: Use connection pooling for better performance
- **Query Timeout**: Set appropriate timeouts for long-running queries
- **Read Replicas**: Consider read replicas for heavy reporting workloads

## 🧪 Testing Strategy

### Database Testing
```typescript
// Example test with test database
describe('Order Repository', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('should create and retrieve orders', async () => {
    const order = await orderRepository.create(testOrderData);
    expect(order.id).toBeDefined();
    
    const retrieved = await orderRepository.findById(order.id);
    expect(retrieved).toEqual(order);
  });
});
```

### Integration Testing with Database
- Use separate test database instance
- Seed test data for consistent tests
- Clean up after each test run
- Test database constraints and foreign keys

## 📅 Implementation Timeline

### Week 1: Planning and Setup
- Choose database provider and plan
- Design detailed schema with team review
- Set up development and test databases

### Week 2: Core Implementation
- Implement database models and repositories
- Replace order store with database calls
- Update integration tests

### Week 3: Testing and Refinement
- Comprehensive testing of all order flows
- Performance testing and optimization
- Error handling and edge cases

### Week 4: Production Preparation
- Production database setup
- Monitoring and alerting configuration
- Deployment and migration procedures

## 🎯 Success Metrics

### Technical Metrics
- **Query Performance**: All order queries under 100ms
- **Availability**: 99.9% database uptime
- **Data Integrity**: Zero data loss or corruption
- **Test Coverage**: 100% coverage of database operations

### Business Metrics
- **Order Processing**: Faster order management workflows
- **Reporting**: Real-time business analytics
- **Scalability**: Support for 10x current order volume
- **Reliability**: Zero payment/order sync issues

---

## 📝 Next Steps

1. **Review and approve** database schema design
2. **Choose database provider** based on requirements and budget
3. **Set up development environment** with chosen database
4. **Begin implementation** following the migration strategy
5. **Plan production deployment** timeline and procedures

This database architecture will provide a solid foundation for scaling your e-commerce platform while maintaining the excellent payment integration you've already built with Stripe.