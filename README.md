# USDT P2P Anomaly Detector Dashboard (Vietnam - VND)

A web dashboard that detects price anomalies between Binance P2P USDT advertisements and spot prices in Vietnam using VND currency.

## Features

- Real-time data fetching from Binance APIs
- Detection of USDT P2P price anomalies in Vietnam (VND) based on configurable thresholds
- Focus on Bank Transfer payment methods
- Filterable and sortable anomaly display
- Color-coded anomalies for quick identification of opportunities
- WebSocket-based real-time updates
- Responsive design for desktop and mobile

## Project Structure

- `server/` - Node.js backend
- `client/` - React frontend

## Setup Instructions

### Environment Configuration

1. Copy the example environment file:
```
cp .env.example .env
```

2. Edit the `.env` file to configure your server settings:
```
# Server Configuration
PORT=5000

# API Configuration
BINANCE_API_URL=https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
API_TIMEOUT=10000

# Application Configuration
UPDATE_INTERVAL=60000
DECISION_INTERVAL=60000
DEVIATION_THRESHOLD=0.5

# Default Trading Configuration
DEFAULT_ASSET=USDT
DEFAULT_FIAT=VND
DEFAULT_COUNTRIES=VN
DEFAULT_PAYMENT_METHODS=BANK,BankTransferVietnam

# Cache Configuration
CACHE_TTL=5000

# Logging
LOG_LEVEL=info
```

### Backend Setup

1. Navigate to the server directory:
```
cd server
```

2. Install dependencies:
```
npm install
```

3. Start the server:
```
npm run dev
```

The server will run on the port specified in your `.env` file (default: http://localhost:5000).

### Frontend Setup

1. Navigate to the client directory:
```
cd client
```

2. Install dependencies:
```
npm install
```

3. Start the development server:
```
npm start
```

The frontend will run on http://localhost:3000 by default.

## Configuration

The dashboard allows configuration of:

- Deviation threshold (%) - The minimum percentage difference to mark as an anomaly
- Update interval (ms) - How frequently to fetch new data

## API Endpoints

- `GET /api/anomalies` - Get the latest detected USDT anomalies
- `GET /api/config` - Get the current configuration
- `POST /api/config` - Update the configuration

## WebSocket Events

- `anomalies` - Real-time anomaly detection updates 