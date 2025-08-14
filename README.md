# 🔥 FIRE Simulator

A comprehensive FIRE (Financial Independence, Retire Early) simulation web application that helps you calculate and visualize your path to financial independence.

## ✨ Features

- **📊 FIRE Calculation**: Calculate your path to financial independence using the 4% withdrawal rule
- **💰 Multi-Currency Portfolio**: Track assets in both JPY and USD with real-time exchange rates
- **📈 Financial Projections**: Visualize asset growth and FIRE timeline with interactive charts
- **🎯 Inflation Adjustment**: Account for inflation in future expense calculations
- **📱 Responsive Design**: Mobile-first interface with Japanese localization
- **💾 Data Persistence**: Automatic local storage with JSON import/export functionality
- **🔄 Real-Time Exchange Rates**: Automatic USD/JPY conversion for international portfolios

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fire
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

## 🛠️ Available Scripts

```bash
npm run dev      # Start development server on port 3001
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🏗️ Technology Stack

- **Frontend**: Next.js 15 (App Router) with TypeScript and React 19
- **Styling**: Tailwind CSS v4 with Japanese fonts (Noto Sans JP)
- **Charts**: Recharts for financial data visualization
- **UI Components**: Radix UI primitives with custom styling
- **Data Storage**: Browser localStorage with JSON import/export
- **External APIs**: Real-time USD/JPY exchange rate integration

## 📊 How It Works

### FIRE Calculation Method

The simulator uses the traditional FIRE approach:

1. **4% Withdrawal Rule**: You need 25x your annual expenses in assets
2. **Compound Interest**: Assets grow based on expected annual returns
3. **Inflation Adjustment**: Future expenses are adjusted for inflation
4. **Multi-Currency Support**: Handles both JPY and USD assets with real-time conversion

### Key Inputs

- **Personal Information**: Current age, retirement age, life expectancy
- **Assets**: Multi-currency portfolio with automatic valuation
- **Income & Expenses**: Annual income and monthly expenses
- **Assumptions**: Expected returns, inflation rate, pension income

### Calculation Features

- **Compound Growth**: Monthly compounding of investment returns
- **Inflation Impact**: Real vs nominal value projections
- **Life Expectancy Model**: Statistical model considering medical advancement
- **Retirement Income**: Supports post-retirement income and pension planning

## 🎨 User Interface

The application features:

- **Japanese Localization**: All text and number formatting in Japanese
- **Responsive Design**: Optimized for mobile and desktop
- **Interactive Charts**: Visual representation of asset growth and FIRE timeline
- **Real-Time Calculations**: Instant updates as you modify inputs
- **Data Management**: Export/import settings as JSON files

## 💾 Data Management

- **Automatic Saving**: All inputs are automatically saved to local storage
- **Export/Import**: Save and share your financial scenarios as JSON files
- **Privacy-First**: No data is sent to external servers (except exchange rates)
- **Offline Capable**: Works without internet connection (using cached exchange rates)

## 🔧 Architecture

### Client-Side Application

- Runs entirely in the browser
- No backend database required
- Uses localStorage for data persistence
- Fetches real-time exchange rates from internal API

### Key Components

- **Fire Calculator**: Core calculation engine with compound interest logic
- **Asset Calculator**: Multi-currency portfolio valuation
- **Storage System**: JSON-based data persistence with validation
- **Chart Components**: Interactive financial projections visualization

## 🌍 Localization

The application is designed for Japanese users:

- All UI text in Japanese
- Currency formatting in Japanese style (万円 units)
- Date formatting following Japanese conventions
- Optimized for Japanese financial planning practices

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## ⚠️ Disclaimer

This simulator is for educational and planning purposes only. Investment decisions should be made based on your own research and consultation with qualified financial advisors. Past performance does not guarantee future results.

## 📄 License

This project is licensed under the MIT License.

---

© 2024 FIRE Simulator. 投資判断は自己責任でお願いします。