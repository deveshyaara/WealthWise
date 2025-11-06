#!/usr/bin/env node

/**
 * Environment Variables Verification Script
 * Run this to verify all required environment variables are set
 * Usage: node scripts/verify-env.js
 */

// Load environment variables from .env file
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const requiredEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'GEMINI_API_KEY',
  'ARCJET_KEY',
  'RESEND_API_KEY'
];

console.log('🔍 Checking environment variables...\n');

let missing = [];
let present = [];

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    present.push(varName);
    const value = process.env[varName];
    const preview = value.length > 30 ? value.substring(0, 30) + '...' : value;
    console.log(`✅ ${varName}: ${preview}`);
  } else {
    missing.push(varName);
    console.log(`❌ ${varName}: MISSING`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`✅ Present: ${present.length}/${requiredEnvVars.length}`);
console.log(`❌ Missing: ${missing.length}/${requiredEnvVars.length}`);

if (missing.length > 0) {
  console.log('\n⚠️  Missing variables:', missing.join(', '));
  console.log('\n📝 Add these to your .env file or Vercel environment variables');
  process.exit(1);
} else {
  console.log('\n🎉 All environment variables are set!');
  process.exit(0);
}
