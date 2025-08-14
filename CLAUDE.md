# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a FIRE (Financial Independence, Retire Early) simulation web application that helps users calculate and visualize their path to financial independence. The app runs entirely client-side without a database, using local storage for persistence and external APIs for real-time financial data.

## Technology Stack

- **Frontend**: Next.js 15 (App Router) with TypeScript and React 19
- **Styling**: Tailwind CSS v4 with Japanese fonts and responsive design
- **Charts**: Recharts for financial data visualization
- **UI Components**: Radix UI primitives with custom styling
- **External APIs**: Exchange rate API for USD/JPY conversion
- **Storage**: Browser localStorage with JSON import/export functionality

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (uses port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

## Architecture Overview

### Core Components Structure
- **`src/app/page.tsx`**: Main application with FIRE calculator interface
- **`src/lib/fire-calculator.ts`**: Core FIRE calculation engine with compound interest and inflation adjustments
- **`src/lib/asset-calculator.ts`**: Multi-currency asset portfolio calculations
- **`src/lib/storage.ts`**: Local storage persistence with JSON import/export
- **`src/lib/types.ts`**: Comprehensive TypeScript type definitions
- **`src/components/`**: Reusable UI components organized by category

### Data Flow Architecture
1. **Input Management**: User inputs are managed in React state with real-time local storage persistence
2. **Calculation Engine**: FireCalculator processes financial projections with compound interest, inflation adjustment, and multi-currency support
3. **Visualization**: Results are transformed into chart-friendly data structures for Recharts components
4. **External Data**: Real-time USD/JPY exchange rates from `/api/exchange-rate` endpoint

### Key Architectural Decisions
- **No Database**: Application runs entirely client-side with localStorage persistence
- **Multi-Currency Support**: Handles JPY and USD assets with real-time exchange rate conversion
- **Japanese Localization**: All UI text and number formatting is in Japanese
- **Responsive Design**: Mobile-first approach with Tailwind CSS breakpoints
- **Type Safety**: Comprehensive TypeScript types covering all financial calculations and UI states

### Financial Calculation Architecture
- **FIRE Rule**: Uses 4% withdrawal rule (25x annual expenses)
- **Compound Interest**: Monthly compounding with configurable annual returns
- **Inflation Adjustment**: Real vs nominal value calculations for future projections
- **Life Expectancy**: Statistical model with medical advancement projections
- **Multi-Currency**: Unified asset calculation system supporting JPY/USD conversion

## Key File Relationships

- `fire-calculator.ts` depends on `asset-calculator.ts` for total asset calculations
- `page.tsx` orchestrates data flow between calculator, storage, and UI components
- `types.ts` provides type definitions used across all modules
- Chart components in `components/charts/` consume calculation results from the main calculator
- Storage functions handle data persistence and maintain type safety through validation

## Development Notes

- Financial values are stored in yen internally but displayed in 万円 (10,000 yen units) for user readability
- Exchange rates are fetched from `/api/exchange-rate` with caching and error handling
- Local storage is automatically synced on every input change
- Form validation ensures data integrity before calculations
- All calculations preserve precision using proper numeric handling (not using Decimal.js as originally planned)
- Japanese UI text requires proper font loading (Noto Sans JP configured in layout)

## Common Development Patterns

- **State Management**: useState with useEffect for persistence, no external state management library
- **Data Transformation**: Separate display values from calculation values (万円 vs 円)
- **Error Handling**: Try-catch blocks with user-friendly Japanese error messages
- **Type Validation**: Runtime validation for imported JSON data
- **Currency Handling**: Unified calculation functions that accept currency preferences