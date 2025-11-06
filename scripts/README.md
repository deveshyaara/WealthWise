# Scripts

## verify-env.js

Verifies that all required environment variables are set.

**Usage:**
```bash
node scripts/verify-env.js
```

**When to use:**
- Before deploying to Vercel
- After cloning the repository
- When debugging environment issues

**Required Environment Variables:**
- `DATABASE_URL` - Supabase connection pooling URL
- `DIRECT_URL` - Supabase direct connection URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `GEMINI_API_KEY` - Google Gemini AI API key
- `ARCJET_KEY` - Arcjet rate limiting key
- `RESEND_API_KEY` - Resend email service key
