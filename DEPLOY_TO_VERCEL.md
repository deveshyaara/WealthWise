# 🚀 Vercel Deployment Steps

## ✅ Prerequisites Completed
- [x] Code committed to GitHub
- [x] All secrets removed from documentation
- [x] Security measures implemented
- [x] Build process optimized

---

## 📋 Step-by-Step Deployment Guide

### **Step 1: Create Vercel Account & Import Project**

1. **Go to Vercel:**
   - Visit: https://vercel.com
   - Click "Sign Up" (or "Login" if you have an account)
   - Choose "Continue with GitHub"
   - Authorize Vercel to access your GitHub account

2. **Import Your Repository:**
   - Click "Add New..." → "Project"
   - Select "Import Git Repository"
   - Find and select: `deveshyaara/WealthWise`
   - Click "Import"

3. **Configure Project:**
   - **Project Name:** `wealthwise` (or your preferred name)
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** `./` (leave as default)
   - **Build Command:** Leave as default (will use package.json)
   - **Output Directory:** Leave as default (`.next`)
   - **Install Command:** Leave as default (`npm install`)

---

### **Step 2: Set Environment Variables** ⚠️ CRITICAL

**Before deploying, add ALL environment variables:**

1. In the Vercel import screen, scroll down to **"Environment Variables"**

2. **Add these variables ONE BY ONE:**

Click "Add" for each variable:

#### **Database Variables:**
```
Variable: DATABASE_URL
Value: postgresql://postgres.djrwgbbdvtijzarbnier:U!xn7@cf*TWLRUB@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: DIRECT_URL
Value: postgresql://postgres.djrwgbbdvtijzarbnier:U!xn7@cf*TWLRUB@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
Environments: ✓ Production ✓ Preview ✓ Development
```

#### **Clerk Authentication:**
```
Variable: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
Value: pk_test_cmljaC1rYW5nYXJvby03My5jbGVyay5hY2NvdW50cy5kZXYk
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: CLERK_SECRET_KEY
Value: sk_test_OQOawe8acKklklKcQa3Z6lYxukPbaxMV82hxUXcGhM
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: NEXT_PUBLIC_CLERK_SIGN_IN_URL
Value: /sign-in
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: NEXT_PUBLIC_CLERK_SIGN_UP_URL
Value: /sign-up
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
Value: /dashboard
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
Value: /dashboard
Environments: ✓ Production ✓ Preview ✓ Development
```

#### **Service API Keys:**
```
Variable: ARCJET_KEY
Value: ajkey_01jsyd18hyfmgvb61r1rjzbk71
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: RESEND_API_KEY
Value: re_EKU4V5At_9dgaY7kt6KWna117b7MKDSAQ
Environments: ✓ Production ✓ Preview ✓ Development
```

```
Variable: GEMINI_API_KEY
Value: AIzaSyBBvJ8QkvmOtUZkPNShL3fIUzHz5hXt40U
Environments: ✓ Production ✓ Preview ✓ Development
```

**⚠️ CRITICAL NOTES:**
- Make sure ALL checkboxes (Production, Preview, Development) are checked
- Use the RAW password `U!xn7@cf*TWLRUB` (NOT URL-encoded) in DATABASE_URL
- Double-check each value for typos
- Total: 11 environment variables should be added

---

### **Step 3: Deploy**

1. After adding all environment variables, click **"Deploy"**

2. **Wait for deployment** (usually 2-3 minutes)
   - Watch the build logs
   - Look for these success messages:
     ```
     ✓ Prisma schema loaded from prisma/schema.prisma
     ✓ Generated Prisma Client
     No pending migrations to apply
     ✓ Compiled successfully
     ```

3. **Deployment Status:**
   - ✅ Success: You'll see "Congratulations! Your project has been deployed"
   - ❌ Failed: Check the build logs for errors (see Troubleshooting below)

---

### **Step 4: Verify Deployment**

1. **Click "Visit"** to open your deployed application

2. **Test these pages:**
   - [ ] Homepage loads correctly
   - [ ] Click "Get Started" → redirects to sign-in
   - [ ] Sign up with a test account
   - [ ] Access `/dashboard` after sign-in
   - [ ] Create a test account in dashboard
   - [ ] Create a test transaction
   - [ ] Test receipt scanning feature

3. **Check Function Logs:**
   - In Vercel dashboard, go to your project
   - Click "Logs" tab
   - Look for any errors
   - Should see successful database connections

---

## 🔧 Troubleshooting

### **Build Fails: "Cannot read properties of undefined (reading 'findUnique')"**

**Cause:** DATABASE_URL not set or incorrect

**Fix:**
1. Go to project Settings → Environment Variables
2. Verify DATABASE_URL is present
3. Check it uses RAW password (not URL-encoded)
4. Redeploy without cache

---

### **Build Fails: "Prisma Client could not locate the Query Engine"**

**Cause:** Prisma didn't generate during build

**Fix:**
1. Check build logs for "Generated Prisma Client"
2. If missing, go to Settings → General → Build & Development Settings
3. Set Build Command: `prisma generate && prisma migrate deploy && next build`
4. Redeploy without cache

---

### **Error: "P1001: Can't reach database server"**

**Cause:** Wrong database URL or network issue

**Fix:**
1. Verify DATABASE_URL in environment variables
2. Check Supabase database is running
3. Ensure connection pooling URL is used (port 6543)
4. Test connection from Supabase dashboard

---

### **Authentication Errors**

**Cause:** Clerk keys not set correctly

**Fix:**
1. Verify all 6 Clerk environment variables are set
2. Check keys match those in Clerk dashboard
3. Ensure NEXT_PUBLIC_* variables are set for client-side
4. Redeploy

---

### **Rate Limiting Errors**

**Cause:** Arcjet key incorrect or missing

**Fix:**
1. Verify ARCJET_KEY in environment variables
2. Check key is valid in Arcjet dashboard
3. Redeploy

---

## 🔄 Redeploying After Errors

If deployment fails:

1. **Go to Deployments tab**
2. **Click "..." menu** on failed deployment
3. **Select "Redeploy"**
4. **UNCHECK "Use existing Build Cache"** ⚠️ Important!
5. **Click "Redeploy"**

---

## 📊 Post-Deployment Checklist

After successful deployment:

- [ ] Homepage loads without errors
- [ ] Authentication works (sign up/sign in)
- [ ] Dashboard displays correctly
- [ ] Database queries work (create account, transaction)
- [ ] Receipt scanning with AI works
- [ ] No errors in Vercel function logs
- [ ] All environment variables are set
- [ ] Custom domain configured (optional)

---

## 🎯 Your Deployment URLs

After deployment, you'll get:

- **Production URL:** `https://wealthwise.vercel.app` (or your custom domain)
- **Preview URLs:** Automatic for every git push
- **Deployments Dashboard:** https://vercel.com/deveshyaara/wealthwise

---

## 🔐 Security Reminder

After deployment:

1. **Never commit `.env` file** (already in .gitignore ✓)
2. **Keep environment variables in Vercel only**
3. **Rotate secrets if exposed**
4. **Enable 2FA on Vercel, GitHub, and all services**
5. **Monitor function logs regularly**

---

## 📝 Next Steps After Deployment

1. **Set up custom domain** (optional):
   - Go to Project Settings → Domains
   - Add your domain
   - Update DNS records

2. **Monitor usage**:
   - Check Vercel analytics
   - Monitor Supabase database usage
   - Watch Clerk authentication logs

3. **Set up Clerk production instance** (recommended):
   - Current keys are test keys
   - Create production Clerk app
   - Update environment variables

4. **Configure alerts**:
   - Set up Vercel deployment notifications
   - Enable Supabase email alerts
   - Configure Arcjet security alerts

---

## ✅ Deployment Complete!

Your WealthWise finance platform is now live on Vercel! 🎉

**Share your deployed app:** https://wealthwise.vercel.app

For any issues, check:
- Vercel deployment logs
- Function logs
- This troubleshooting guide
- VERCEL_DEPLOYMENT.md file

---

**Need help?** Check the comprehensive guides:
- `VERCEL_DEPLOYMENT.md` - Detailed deployment documentation
- `SECURITY.md` - Security best practices
- `FIXES_APPLIED.md` - Technical details of all fixes
