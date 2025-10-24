# Stripe Mobile Payment Domain Verification Guide

## Executive Summary

This guide provides comprehensive instructions for domain verification required to enable Apple Pay, Google Pay, and Link payment methods in your Stripe integration. The process is streamlined through Stripe's unified domain registration system, eliminating the complexity of traditional Apple merchant validation.

**Time Investment:** ~5-10 minutes total setup time  
**Complexity:** Simple - Stripe handles all certificate management  
**Scope:** Required for Apple Pay, Google Pay, and Link payment methods  

---

## 🔍 Overview

### What is Domain Verification?

Domain verification is a security requirement that ensures payment methods like Apple Pay, Google Pay, and Link can only be used on domains that you own and control. Stripe requires this verification to enhance security and comply with industry best practices.

### Why is it Required?

- **Security**: Prevents unauthorized use of payment methods on unverified domains
- **Compliance**: Meets Apple Pay, Google Pay, and industry security standards
- **Trust**: Ensures customers see payment options only on legitimate merchant sites
- **Regulatory**: Aligns with payment industry best practices for 2025

### Modern Unified Process

✅ **One Registration = All Payment Methods**: Register your domain once in Stripe, and it automatically works for Apple Pay, Google Pay, AND Link  
✅ **Stripe-Managed**: No complex Apple Developer account setup required  
✅ **Automatic Certificate Management**: Stripe handles all Apple merchant validation certificates  
✅ **Real-time Verification**: Immediate activation once verification completes  

---

## 🚀 Step-by-Step Domain Verification Process

### Step 1: Access Stripe Dashboard

1. **Login to Stripe Dashboard**
   - Navigate to: [https://dashboard.stripe.com](https://dashboard.stripe.com)
   - Use your live Stripe account credentials

2. **Navigate to Payment Methods**
   - Go to **Settings** → **Payment Methods** → **Domains**
   - Or direct URL: `https://dashboard.stripe.com/settings/payment_methods`

### Step 2: Register Your Domains

#### 2.1 Add New Domain
1. Click **"Add a new domain"** button
2. Enter your domain name (without protocol)
   - ✅ Correct: `my-store.com`
   - ❌ Incorrect: `https://my-store.com`

#### 2.2 Register All Domain Variations
**Critical**: You must register **every** domain and subdomain variation you use:

**Example Domain Registration Checklist:**
- [ ] `my-store.com` (root domain)
- [ ] `www.my-store.com` (www subdomain)
- [ ] `shop.my-store.com` (if using subdomain)
- [ ] `checkout.my-store.com` (if checkout on subdomain)
- [ ] Testing domains (see Step 5)

#### 2.3 Save and Continue
- Click **"Save and continue"** for each domain
- Repeat for all domain variations

### Step 3: Apple Pay Domain Association File (Apple Pay Only)

**Note**: This step is only required for Apple Pay. Google Pay and Link work automatically once domain is registered.

#### 3.1 Download Association File
1. In Stripe Dashboard, you'll see a download link for the domain association file
2. Download: `apple-developer-merchantid-domain-association`
3. **Important**: This is a file with no extension

#### 3.2 Host the Association File
**File Location**: `/.well-known/apple-developer-merchantid-domain-association`

**For Next.js Applications** (like your project):
```bash
# Create the directory structure
mkdir -p public/.well-known

# Move the downloaded file
mv ~/Downloads/apple-developer-merchantid-domain-association public/.well-known/
```

**Verify File Accessibility**:
- The file must be accessible at: `https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association`
- Test in browser: should download the file (not show 404)
- **No authentication required**: File must be publicly accessible

#### 3.3 File Content Verification
The file content should look similar to:
```
7B227073704964223A2239393939393939392D393939392D393939392D393939392D393939393939393939393939222C2276657273696F6E223A312C22637265617465644F6E223A313534333836343637323737362C227369676E6174757265223A22333038363036...
```

**Important Notes**:
- Do NOT modify this file
- File has no extension
- Must be exactly as downloaded from Stripe
- File is cryptographically signed by Apple

### Step 4: Complete Domain Verification

#### 4.1 Verify in Stripe Dashboard
1. Return to Stripe Dashboard → Payment Methods → Domains
2. Find your registered domain
3. Click **"Verify"** button next to each domain

#### 4.2 Verification Success Indicators
- ✅ **"Enabled"** badge appears next to domain
- ✅ Status changes from "Pending" to "Active"  
- ✅ Payment methods become available in Elements/Checkout

#### 4.3 Troubleshooting Verification Failures
**Common Issues & Solutions**:

❌ **Apple Pay file not accessible**
- Ensure file is at exact path: `/.well-known/apple-developer-merchantid-domain-association`
- Verify file is publicly accessible (test in incognito browser)
- Check web server configuration (no authentication required)

❌ **Domain not responding**
- Ensure domain is live and accessible via HTTPS
- Verify DNS is properly configured
- Check SSL certificate is valid

❌ **Subdomain issues**
- Register each subdomain separately
- Verify file is accessible on each subdomain
- Ensure consistent SSL configuration across all subdomains

### Step 5: Testing Environment Setup

#### 5.1 Local Development Domains
**For localhost testing**, you need HTTPS domains. Use ngrok:

```bash
# Install ngrok (if not already installed)
npm install -g ngrok

# Start your development server
npm run dev

# In another terminal, create HTTPS tunnel
ngrok http 3000

# Register the ngrok domain in Stripe Dashboard
# Example: https://abc123.ngrok.io
```

#### 5.2 Staging Environment
- Register your staging domain: `staging.my-store.com`
- Deploy association file to staging environment
- Verify staging domain in Stripe Dashboard

#### 5.3 Testing vs Live Mode Domains
**Important**: Register domains in **both** test and live modes:
- **Test Mode**: For development and staging
- **Live Mode**: For production deployment
- Domains registered in live mode automatically work in test mode
- **Recommendation**: Register in live mode for universal coverage

---

## 🔧 Technical Implementation Details

### Domain Verification API (Optional)

For programmatic domain registration:

```typescript
// Using Stripe API to register domain
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const paymentMethodDomain = await stripe.paymentMethodDomains.create({
  domain_name: 'my-store.com',
});

// Validate domain after registration
const validation = await stripe.paymentMethodDomains.validate(
  paymentMethodDomain.id
);
```

### Next.js Configuration

Ensure your Next.js application serves the association file correctly:

```javascript
// next.config.js - Ensure static files are served
module.exports = {
  // ... other configuration
  
  // Ensure .well-known directory is accessible
  async rewrites() {
    return [
      {
        source: '/.well-known/:path*',
        destination: '/.well-known/:path*',
      },
    ];
  },
};
```

### Environment Variables

Update your environment configuration:

```bash
# .env.local
# Domain verification status
NEXT_PUBLIC_APPLE_PAY_DOMAIN_VERIFIED=true
NEXT_PUBLIC_GOOGLE_PAY_DOMAIN_VERIFIED=true
NEXT_PUBLIC_LINK_DOMAIN_VERIFIED=true

# Domain information
NEXT_PUBLIC_DOMAIN=my-store.com
```

---

## 📋 Verification Checklist

### Pre-Verification Checklist
- [ ] Stripe account in good standing
- [ ] Domain is live and accessible via HTTPS
- [ ] SSL certificate is valid and properly configured
- [ ] DNS records are properly configured

### Apple Pay Verification Checklist
- [ ] Domain registered in Stripe Dashboard
- [ ] Association file downloaded from Stripe
- [ ] File placed at `/.well-known/apple-developer-merchantid-domain-association`
- [ ] File accessible via HTTPS (test in browser)
- [ ] File content unmodified from Stripe download
- [ ] Domain verified successfully in Stripe Dashboard

### Google Pay Verification Checklist
- [ ] Domain registered in Stripe Dashboard
- [ ] Domain verified successfully in Stripe Dashboard
- [ ] No additional files required

### Link Verification Checklist  
- [ ] Domain registered in Stripe Dashboard
- [ ] Domain verified successfully in Stripe Dashboard
- [ ] No additional files required

### Testing Verification Checklist
- [ ] ngrok or testing domain registered
- [ ] Association file accessible on testing domain
- [ ] Payment methods appear in test environment
- [ ] Test payments work correctly

### Production Verification Checklist
- [ ] Production domain registered in live mode
- [ ] Association file deployed to production
- [ ] Domain verification successful in live mode
- [ ] Payment methods active in production

---

## 🔍 Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Apple Pay Button Not Appearing
**Symptoms**: Apple Pay button doesn't show on iOS Safari
**Solutions**:
1. **Check Domain Registration**:
   ```bash
   # Verify domain is registered and active in Stripe Dashboard
   curl -I https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association
   ```
2. **Verify Association File**:
   - File must return HTTP 200 status
   - Content-Type should be application/octet-stream or text/plain
   - File size should be several KB (cryptographic signature)

3. **Browser Testing**:
   ```javascript
   // Test Apple Pay availability in browser console
   if (window.ApplePaySession) {
     console.log('Apple Pay supported');
     console.log('Can make payments:', ApplePaySession.canMakePayments());
   }
   ```

#### Issue: Google Pay Button Not Appearing
**Symptoms**: Google Pay button doesn't show on Android Chrome
**Solutions**:
1. **Verify Domain Registration**: Ensure domain is registered and verified
2. **Test Google Pay API**:
   ```javascript
   // Test Google Pay availability
   const paymentsClient = new google.payments.api.PaymentsClient({
     environment: 'TEST' // or 'PRODUCTION'
   });
   
   paymentsClient.isReadyToPay({
     allowedPaymentMethods: [{
       type: 'CARD',
       parameters: {
         allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
         allowedCardNetworks: ['VISA', 'MASTERCARD']
       }
     }]
   }).then(response => {
     console.log('Google Pay ready:', response.result);
   });
   ```

#### Issue: Link Not Working
**Symptoms**: Link authentication element not appearing
**Solutions**:
1. **Domain Verification**: Verify domain is registered in Stripe
2. **Elements Configuration**:
   ```javascript
   // Ensure Link is enabled in Elements configuration
   const linkAuthElement = elements.create('linkAuthentication', {
     // Configuration options
   });
   ```

#### Issue: Subdomain Problems
**Symptoms**: Payment methods work on main domain but not subdomain
**Solutions**:
1. **Register Each Subdomain**: Each subdomain needs separate registration
2. **Association File**: Deploy association file to each subdomain
3. **SSL Consistency**: Ensure SSL certificates cover all subdomains

#### Issue: Testing Environment Issues
**Symptoms**: Payment methods not working in development
**Solutions**:
1. **Use HTTPS**: Payment methods require HTTPS (use ngrok)
2. **Register Testing Domain**: Register ngrok/testing domain in Stripe
3. **Environment Configuration**: Ensure test keys are used properly

### Support Resources

**Stripe Documentation**:
- [Payment Method Domains](https://docs.stripe.com/payments/payment-methods/pmd-registration)
- [Apple Pay Integration](https://docs.stripe.com/apple-pay?platform=web)
- [Google Pay Integration](https://docs.stripe.com/google-pay)

**Stripe Support**:
- Dashboard: Settings → Support
- Email: Support available through Dashboard
- Documentation: [https://docs.stripe.com](https://docs.stripe.com)

---

## 🚀 Post-Verification Next Steps

### 1. Update Environment Configuration
```bash
# .env.local
NEXT_PUBLIC_APPLE_PAY_DOMAIN_VERIFIED=true
NEXT_PUBLIC_GOOGLE_PAY_DOMAIN_VERIFIED=true
NEXT_PUBLIC_LINK_DOMAIN_VERIFIED=true
```

### 2. Enable Payment Methods in Code
With domains verified, your automatic payment methods configuration will now work:

```typescript
// src/config/stripe.ts
paymentIntent: {
  automaticPaymentMethods: {
    enabled: true, // Now fully functional with verified domains
    allow_redirects: 'never',
  },
}
```

### 3. Test Payment Methods
**Test each payment method**:
- Apple Pay: Use iOS Safari or macOS Safari
- Google Pay: Use Android Chrome or Chrome with saved cards  
- Link: Use any browser with Link-enabled email

### 4. Deploy to Production
With domains verified:
- Deploy association file to production
- Enable payment methods in live mode
- Monitor payment success rates
- Track conversion improvements

### 5. CI/CD Integration
Add domain verification checks to your deployment pipeline:

```bash
# scripts/validate-domains.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function validateDomains() {
  const domains = await stripe.paymentMethodDomains.list();
  const activeDomains = domains.data.filter(d => d.enabled);
  
  if (activeDomains.length === 0) {
    throw new Error('No verified domains found. Mobile payments will not work.');
  }
  
  console.log(`✅ ${activeDomains.length} verified domains ready for mobile payments`);
}

validateDomains().catch(console.error);
```

---

## 📊 Success Validation

### Verification Success Indicators

✅ **Stripe Dashboard**: All domains show "Enabled" status  
✅ **Apple Pay**: Button appears on iOS Safari  
✅ **Google Pay**: Button appears on Android Chrome  
✅ **Link**: Authentication element appears in checkout  
✅ **Test Payments**: Successful test transactions for each payment method  

### Performance Monitoring

Track the impact of mobile payment enablement:

```typescript
// Enhanced monitoring post-domain verification
const mobilePaymentMetrics = {
  applePayAttempts: 0,
  applePaySuccesses: 0,
  googlePayAttempts: 0,
  googlePaySuccesses: 0,
  linkAttempts: 0,
  linkSuccesses: 0,
  conversionImprovement: 0, // Target: +25-40%
};
```

### Expected Results

**Short-term (1-2 weeks)**:
- Mobile payment buttons appear consistently
- Payment method availability improves
- Initial mobile payment adoption begins

**Medium-term (1-2 months)**:
- 15-25% conversion rate improvement (Phase 1 foundation)
- 40%+ mobile payment adoption
- Reduced cart abandonment

**Long-term (3-6 months)**:
- 25-40% total conversion improvement (with mobile payments)
- Enhanced customer experience
- Increased customer retention

---

**Document Version**: 1.0  
**Created**: January 2025  
**Last Updated**: January 2025  
**Next Review**: After domain verification completion  

**Prerequisites**: Completed Phase 1 Stripe Modernization Plan  
**Next Step**: Begin Phase 2 Mobile Payment Testing Plan implementation  

For questions or issues during domain verification, consult:
- This document's troubleshooting section
- Stripe Dashboard support resources
- Project technical documentation in `/docs/`