# Crossmint Web Interface

Web interface for Crossmint wallet authentication and top-ups, designed to work with the Telegram shopping bot.

## Overview

This Next.js application provides the web components needed for:
- **Wallet Authentication**: Crossmint client-side wallet creation
- **Credit Card Top-ups**: Secure payment processing for wallet funding
- **Bot Integration**: Communication back to the Telegram bot

## Quick Setup

### 1. Install Dependencies

```bash
cd web-interface
npm install
```

### 2. Environment Configuration

Copy the environment file and configure:

```bash
cp env.example .env.local
```

Update `.env.local` with your configuration:
- `CROSSMINT_CLIENT_API_KEY`: Your client-side Crossmint API key
- `NEXTAUTH_URL`: Your deployed web app URL (must be HTTPS)

### 3. Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 4. Production Deployment

#### Option A: Vercel (Recommended)

1. Push to GitHub repository
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

#### Option B: Custom Server

```bash
npm run build
npm start
```

## Routes

### `/auth`
Handles wallet authentication and creation:
- Receives state parameter from Telegram bot
- Integrates with Crossmint client-side SDK
- Creates user wallet securely
- Redirects back to Telegram

**Example URL**: `https://your-app.vercel.app/auth?state=eyJ1c2VySWQiOjEyMz...&return=telegram`

### `/topup`
Handles credit card payments for wallet funding:
- Receives session data from Telegram bot
- Integrates with Crossmint hosted checkout
- Processes payment securely
- Updates wallet balance

**Example URL**: `https://your-app.vercel.app/topup?session=topup_123_456&amount=25&currency=USD`

## API Routes

### `POST /api/webhook/wallet-created`
Webhook endpoint for wallet creation completion:
- Receives wallet data from Crossmint
- Updates bot's user database
- Returns success confirmation

### `POST /api/webhook/payment-completed`
Webhook endpoint for payment completion:
- Receives payment confirmation from Crossmint
- Updates user wallet balance
- Notifies bot of successful top-up

## Integration with Telegram Bot

### Environment Variables
Update your main bot's `.env` file:

```bash
WEB_APP_URL=https://your-app.vercel.app
```

### Bot Configuration
The wallet service will automatically generate proper URLs:
- Authentication: `https://your-app.vercel.app/auth?state=...`
- Top-up: `https://your-app.vercel.app/topup?session=...`

## Real Crossmint Integration

### 1. Install Crossmint SDK

```bash
npm install @crossmint/client-sdk-react
```

### 2. Update Auth Page

Replace the mock implementation in `app/auth/page.tsx` with real Crossmint wallet creation:

```tsx
import { CrossmintAuth } from '@crossmint/client-sdk-react';

// Use actual Crossmint authentication flow
const { login, user } = CrossmintAuth({
  clientApiKey: process.env.CROSSMINT_CLIENT_API_KEY,
  environment: process.env.CROSSMINT_ENVIRONMENT
});
```

### 3. Update Top-up Page

Replace the mock implementation in `app/topup/page.tsx` with real Crossmint checkout:

```tsx
import { CrossmintPayButton } from '@crossmint/client-sdk-react';

// Use actual Crossmint hosted checkout
<CrossmintPayButton
  clientId={process.env.CROSSMINT_CLIENT_API_KEY}
  mintConfig={{
    totalPrice: sessionData.amount,
    currency: sessionData.currency
  }}
/>
```

## Testing

### 1. Local Testing with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Start your Next.js app
npm run dev

# In another terminal, expose localhost:3000
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update WEB_APP_URL in your bot's .env file
```

### 2. Test Wallet Flow

1. Start the Telegram bot
2. Search for a product: `/search wireless headphones`
3. Click "Buy with Crossmint"
4. Should redirect to your web interface for wallet creation
5. After completion, redirects back to Telegram

## Security Considerations

- **HTTPS Required**: Telegram only allows HTTPS URLs in inline keyboards
- **State Validation**: Always validate state parameters from Telegram
- **Webhook Security**: Implement proper signature verification for webhooks
- **Environment Variables**: Never expose API keys in client-side code

## Troubleshooting

### "Invalid web app URL for Telegram"
- Ensure `WEB_APP_URL` starts with `https://`
- Cannot use `localhost` or `127.0.0.1`
- Use ngrok for local testing

### "Wallet creation is currently unavailable"
- Check `WEB_APP_URL` configuration
- Verify web interface is accessible via HTTPS
- Check Crossmint API key configuration

### "Top-up currently unavailable"
- Same as above - check URL configuration
- Verify Crossmint hosted checkout integration

## Production Checklist

- [ ] Deploy web interface to HTTPS domain
- [ ] Update `WEB_APP_URL` in bot environment
- [ ] Configure real Crossmint SDK integration
- [ ] Set up webhook endpoints for production
- [ ] Test complete wallet + purchase flow
- [ ] Monitor error logs and performance

## Support

For integration help:
1. Check Crossmint documentation: https://docs.crossmint.com
2. Verify environment variable configuration
3. Test with ngrok for local development
4. Check bot logs for detailed error messages 