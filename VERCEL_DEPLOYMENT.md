# Vercel Deployment Guide

## Environment Variables Setup

### CRITICAL: In Vercel Dashboard

Go to: **Settings → Environment Variables**

Add these for **Production**, **Preview**, and **Development**:

```env
# Database - USE RAW PASSWORD (NOT URL-encoded)
# Get these from Supabase Dashboard > Settings > Database > Connection String
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

# Clerk Authentication
# Get these from Clerk Dashboard > API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Services
# Get your API keys from respective service dashboards
ARCJET_KEY=ajkey_YOUR_ARCJET_KEY
RESEND_API_KEY=re_YOUR_RESEND_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

## Build Settings

In Vercel Dashboard: **Settings → General → Build & Development Settings**

- **Framework Preset:** Next.js
- **Build Command:** `prisma generate && prisma migrate deploy && next build`
- **Install Command:** `npm install`
- **Output Directory:** `.next`

## Deployment Steps

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Fix: Prisma client initialization for Vercel"
   git push origin main
   ```

2. **In Vercel Dashboard:**
   - Go to your project
   - Click "Settings" → "Environment Variables"
   - Add ALL variables from above
   - Make sure to add them for ALL environments (Production, Preview, Development)

3. **Redeploy:**
   - Go to "Deployments" tab
   - Click "Redeploy" on latest deployment
   - **UNCHECK** "Use existing Build Cache"
   - Click "Redeploy"

4. **Verify Deployment:**
   - Check deployment logs for:
     ```
     ✓ Prisma schema loaded from prisma/schema.prisma
     ✓ Generated Prisma Client
     ✓ Compiled successfully
     ```

## Troubleshooting

### Error: "Cannot read properties of undefined (reading 'findUnique')"
**Cause:** DATABASE_URL not set in Vercel
**Fix:** Add DATABASE_URL to Vercel environment variables

### Error: "Prisma Client could not locate the Query Engine"
**Cause:** prisma generate didn't run during build
**Fix:** Verify build command includes `prisma generate`

### Error: "P1001: Can't reach database server"
**Cause:** Wrong database URL or password encoding
**Fix:** Use RAW password in DATABASE_URL, not URL-encoded

### Error: Still failing after adding env vars
**Cause:** Build cache
**Fix:** Redeploy without build cache

## Verify Environment Variables Locally

Run this before deploying:

```bash
node scripts/verify-env.js
```

This will check if all required environment variables are set.

## Post-Deployment Checklist

- [ ] All environment variables added to Vercel
- [ ] DATABASE_URL uses raw password (not URL-encoded)
- [ ] Build logs show "Generated Prisma Client"
- [ ] Application loads without errors
- [ ] Dashboard page works
- [ ] Database queries work

## Support

If issues persist:
1. Check Vercel function logs
2. Verify all environment variables are set
3. Ensure database is accessible from Vercel's region
4. Check Supabase connection pooler is enabled
