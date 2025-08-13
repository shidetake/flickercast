# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a FIRE (Financial Independence, Retire Early) simulation web application built with Next.js, TypeScript, and PostgreSQL. The application helps users calculate and visualize their path to financial independence through asset management, expense tracking, and Monte Carlo simulations.

## Technology Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS v4
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with credentials provider
- **Charts**: Recharts for data visualization
- **External APIs**: Yahoo Finance, Alpha Vantage, Bank of Japan
- **Styling**: Tailwind CSS with custom CSS variables and Japanese fonts (Noto Sans JP)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Database commands
npm run db:generate    # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:migrate    # Create and apply migrations
npm run db:studio     # Open Prisma Studio

# Build and lint
npm run build
npm run lint
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles with CSS variables
│   ├── layout.tsx         # Root layout with Japanese fonts
│   └── page.tsx          # Main FIRE simulator page
├── components/
│   ├── charts/           # Recharts visualizations
│   ├── dashboard/        # Dashboard components
│   ├── forms/           # Data input forms
│   └── ui/              # Reusable UI components
└── lib/
    ├── fire-calculator.ts # Core FIRE calculation engine
    ├── monte-carlo.ts   # Monte Carlo simulation logic
    ├── external-apis.ts # External API integrations (client-side)
    ├── storage.ts       # Local storage management & JSON import/export
    ├── types.ts         # TypeScript type definitions
    └── utils.ts         # Utility functions
```

## Key Features Implemented

1. **FIRE Calculator**: 4% rule implementation with inflation adjustment
2. **Asset Management**: Multi-asset portfolio tracking with automatic price updates
3. **Expense Tracking**: Categorized expenses with retirement multipliers
4. **Visualization**: Interactive charts showing asset growth and FIRE timeline
5. **Monte Carlo Simulations**: Risk analysis with multiple scenarios
6. **External Data Integration**: Real-time stock prices and economic indicators
7. **Responsive Design**: Mobile-first design with Japanese UI

## Database Schema

The Prisma schema includes:
- **Users**: Authentication and profile data
- **Assets**: Portfolio holdings with auto-update capabilities
- **Expenses**: Categorized spending with retirement projections
- **Scenarios**: Multiple assumption sets for comparison
- **Projections**: Calculated FIRE outcomes
- **EconomicIndicators**: External market data
- **LifeEvents**: Major financial milestones

## External API Configuration

Set these environment variables in `.env`:
```bash
DATABASE_URL="your-postgres-url"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
YAHOO_FINANCE_API_KEY=""
ALPHA_VANTAGE_API_KEY=""
```

## Development Notes

- Uses Prisma's automatic database URL for local development
- All financial calculations use Decimal types for precision
- External APIs have fallback mechanisms (Yahoo Finance → Alpha Vantage)
- Monte Carlo simulations use Box-Muller transformation for normal distribution
- Charts support both light and dark themes
- Form validation with Zod schemas
- Japanese localization throughout the UI

## Common Tasks

- **Add new asset types**: Update `AssetType` enum in schema.prisma
- **Modify FIRE calculations**: Edit `fire-calculator.ts`
- **Add new charts**: Create components in `components/charts/`
- **External API integration**: Extend `external-apis.ts`
- **Database changes**: Update schema.prisma and run migrations