# Stripe CLI Setup and Configuration

This guide provides instructions for setting up the Stripe CLI for local webhook testing and development.

## Installation

### Windows Installation

1. **Download Stripe CLI**
   - Visit: https://github.com/stripe/stripe-cli/releases/latest
   - Download `stripe_X.X.X_windows_x86_64.tar.gz` for 64-bit Windows
   - Extract to a folder (e.g., `C:\stripe-cli\`)

2. **Add to PATH (Optional)**
   ```bash
   # Add the Stripe CLI directory to your system PATH
   # This allows you to run `stripe` from anywhere
   setx PATH "%PATH%;C:\stripe-cli"
   ```

3. **Verify Installation**
   ```bash
   stripe --version
   ```

### Alternative Installation Methods

#### Using Chocolatey (if available)
```bash
choco install stripe-cli
```

#### Using Scoop (if available)
```bash
scoop install stripe
```

#### Using Windows Package Manager
```bash
winget install stripe.stripe-cli
```

## Authentication

### Login to Stripe Account
```bash
# This will open a browser window for authentication
stripe login

# Or use a restricted key for CI/CD
stripe login --api-key sk_test_...
```

### Verify Authentication
```bash
stripe config --list
```

## Webhook Configuration for Development

### 1. Start Webhook Forwarding
```bash
# Forward webhooks to your local development server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# This will output your webhook secret (whsec_...)
# Copy this secret to your .env.local file
```

### 2. Environment Variables Setup

Add the webhook secret to your `.env.local` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_...webhook_secret_from_cli

# The webhook secret is provided when you run stripe listen
```

### 3. Test Webhook Events

In another terminal, trigger test events:

```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test failed payment
stripe trigger payment_intent.payment_failed

# Test specific payment intent
stripe trigger payment_intent.succeeded --add payment_intent:metadata:orderId=test_order_123
```

## Development Workflow

### Start Development Environment

1. **Terminal 1: Start Next.js Development Server**
   ```bash
   npm run dev
   ```

2. **Terminal 2: Start Stripe CLI Webhook Forwarding**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. **Terminal 3: Trigger Test Events (Optional)**
   ```bash
   stripe trigger payment_intent.succeeded
   ```

### Testing Payment Flow

1. **Create Test Payment Intent**
   ```bash
   stripe payment_intents create \
     --amount 2500 \
     --currency ron \
     --metadata orderId=test_order_123
   ```

2. **Monitor Webhook Events**
   ```bash
   stripe logs tail
   ```

3. **View Dashboard**
   ```bash
   stripe dashboard
   # Opens Stripe Dashboard in browser
   ```

## Production Webhook Setup

### 1. Create Webhook Endpoint in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Enter your production URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the signing secret (whsec_...)

### 2. Update Production Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...your_live_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...your_live_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_...production_webhook_secret
```

## Useful Stripe CLI Commands

### Account and Configuration
```bash
# Login to Stripe account
stripe login

# List configuration
stripe config --list

# Set configuration
stripe config --set default_account acct_...

# List accounts
stripe accounts list
```

### Payment Intents
```bash
# List payment intents
stripe payment_intents list --limit 10

# Retrieve specific payment intent
stripe payment_intents retrieve pi_...

# Create payment intent
stripe payment_intents create --amount 2500 --currency ron
```

### Webhooks
```bash
# List webhook endpoints
stripe webhook_endpoints list

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Forward specific events only
stripe listen --events payment_intent.succeeded,payment_intent.payment_failed --forward-to localhost:3000/api/webhooks/stripe

# View webhook logs
stripe logs tail

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
```

### Events and Logs
```bash
# List recent events
stripe events list --limit 10

# Retrieve specific event
stripe events retrieve evt_...

# View logs
stripe logs tail

# View logs for specific endpoint
stripe logs tail --filter-endpoint wehook_endpoint_id
```

### Testing
```bash
# Trigger various test events
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger payment_intent.requires_action
stripe trigger invoice.payment_succeeded
stripe trigger customer.subscription.created

# Trigger with specific metadata
stripe trigger payment_intent.succeeded --add payment_intent:metadata:orderId=test123
```

## Troubleshooting

### Common Issues

1. **"stripe: command not found"**
   - Ensure Stripe CLI is installed and in your PATH
   - Try running with full path: `C:\stripe-cli\stripe.exe --version`

2. **Authentication Failed**
   ```bash
   stripe login --force
   ```

3. **Webhook Not Receiving Events**
   - Check that your development server is running on localhost:3000
   - Verify the webhook endpoint URL is correct
   - Check firewall settings
   - Ensure the webhook secret matches

4. **Permission Denied**
   - On Windows, ensure the CLI executable has proper permissions
   - Try running as administrator if needed

5. **Events Not Triggering**
   ```bash
   # Check if events are being sent
   stripe events list --limit 5
   
   # Check webhook endpoint status
   stripe webhook_endpoints list
   ```

### Debug Mode

Run Stripe CLI in debug mode for more verbose output:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe --debug
```

### Log Files

Stripe CLI logs are typically stored in:
- Windows: `%USERPROFILE%\.config\stripe\stripe.log`
- macOS/Linux: `~/.config/stripe/stripe.log`

## Security Best Practices

1. **Never commit webhook secrets to version control**
2. **Use test keys for development**
3. **Rotate webhook secrets regularly in production**
4. **Verify webhook signatures in your application**
5. **Use HTTPS in production**
6. **Implement proper error handling and logging**

## Integration with Next.js Application

### Webhook Handler Location
```
src/app/api/webhooks/stripe/route.ts
```

### Environment Variable Validation
The application's environment validation system will check for required Stripe variables:
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`  
- `STRIPE_WEBHOOK_SECRET`

### Testing Checklist

- [ ] Stripe CLI installed and authenticated
- [ ] Webhook forwarding working (`stripe listen`)
- [ ] Environment variables configured
- [ ] Test payment intents can be created
- [ ] Webhook events are received by local server
- [ ] Payment flow works end-to-end
- [ ] Error scenarios are handled properly

## Resources

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Stripe API Reference](https://stripe.com/docs/api)