# AI Finance Platform

A modern, AI-powered financial management platform that helps users track transactions, manage accounts, set budgets, and gain financial insights.

**Live Demo**: [https://wealth-wise-kappa.vercel.app/](https://wealth-wise-kappa.vercel.app/)

![AI Finance Platform Banner](public/banner.jpeg)

## Features

- **Transaction Management**: Track income and expenses with detailed categorization
- **Multiple Account Support**: Manage different types of financial accounts (savings, current)
- **AI-Powered Receipt Scanner**: Extract transaction details automatically from receipts using Gemini AI
- **Budget Tracking**: Set monthly budgets and monitor spending progress
- **Recurring Transactions**: Set up transactions that repeat on daily, weekly, monthly, or yearly intervals
- **Financial Analytics**: Visualize spending patterns with interactive charts
- **Monthly Reports**: Get automated financial summaries and insights
- **Budget Alerts**: Receive notifications when approaching budget limits
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, shadcn/ui
- **Backend**: Next.js Server Actions, Prisma ORM
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **AI**: Google Gemini API for receipt scanning and financial insights
- **Background Jobs**: Inngest for recurring transactions and notifications
- **Email**: Resend for sending reports and alerts
- **Security**: Arcjet for rate limiting and security
- **Visualization**: Recharts for data visualization

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Clerk account
- Google Gemini API key
- Resend API key
- Arcjet account

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ai-finance-platform.git
   cd ai-finance-platform
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   # Database URLs
   DATABASE_URL=postgresql://postgres.[YOUR_SUPABASE_PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   DIRECT_URL=postgresql://postgres.[YOUR_SUPABASE_PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres

   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

   # Google Gemini API Key
   GEMINI_API_KEY=

   # Resend API Key for Email
   RESEND_API_KEY=

   # Arcjet Security Key
   ARCJET_KEY=
   ```

4. Set up your database schema:
   ```bash
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- `/app`: Next.js app router files
- `/components`: Reusable React components
- `/actions`: Server actions for database operations
- `/lib`: Utility functions, database connections, and services
- `/prisma`: Database schema and migrations
- `/data`: Static data like categories and default configs
- `/emails`: Email templates for notifications and reports
- `/hooks`: Custom React hooks

## Key Features Explained

### Transaction Management

Users can create, view, edit, and delete transactions with detailed information including:
- Amount
- Date
- Category
- Type (income or expense)
- Description
- Recurring settings

### Account Management

The platform supports multiple accounts with:
- Balance tracking
- Transaction history
- Income vs expense visualization
- Setting a default account for budgeting

### Budget System

The budgeting feature allows users to:
- Set monthly spending limits
- Track progress with visual indicators
- Receive alerts when approaching limits
- View spending breakdowns by category

### AI Receipt Scanner

Users can scan receipts to automatically:
- Extract the total amount
- Identify the date of purchase
- Determine merchant information
- Categorize the transaction
- Fill in transaction details automatically

### Analytics Dashboard

The dashboard provides:
- Monthly expense breakdown
- Income vs expense comparisons
- Transaction histories
- Budget progress tracking
- Category-based spending analysis

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Shadcn UI](https://ui.shadcn.com/) for the component library
- [Recharts](https://recharts.org/) for data visualization
- [Clerk](https://clerk.com/) for authentication
- [Supabase](https://supabase.com/) for database services
- [Inngest](https://www.inngest.com/) for background processing
- [Google Gemini](https://ai.google.dev/) for AI services
- [Resend](https://resend.com/) for email services
- [Arcjet](https://arcjet.com/) for security services
