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

The server will run on http://localhost:5000 by default.

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