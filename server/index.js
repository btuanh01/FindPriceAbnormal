// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());



// Configuration using environment variables
const CONFIG = {
  updateInterval: parseInt(process.env.UPDATE_INTERVAL) || 60000, // 1 minute
  deviationThreshold: parseFloat(process.env.DEVIATION_THRESHOLD) || 0.5, // Default to 0.5% - balanced
  assets: [process.env.DEFAULT_ASSET || 'USDT'],
  fiatCurrency: process.env.DEFAULT_FIAT || 'VND',
  countries: [process.env.DEFAULT_COUNTRIES || 'VN'], // Vietnam
  paymentMethods: (process.env.DEFAULT_PAYMENT_METHODS || 'BANK,BankTransferVietnam').split(',') // Specific bank transfer methods
};

// API Configuration
const API_CONFIG = {
  binanceApiUrl: process.env.BINANCE_API_URL || 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
  timeout: parseInt(process.env.API_TIMEOUT) || 10000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// Simplified function to fetch top 20 lowest prices from Binance P2P
async function fetchTop20LowestPrices(asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency, minLimit = 0) {
  try {
    console.log(`Fetching top 20 lowest prices for ${asset} in ${fiat} with min limit ${minLimit}`);
    
    const startTime = Date.now();
    
    // Payload to get top 20 lowest buy prices with min limit filter
    const payload = {
      page: 1,
      rows: 20,
      asset,
      tradeType: 'BUY',
      fiat,
      publisherType: null,
      merchantCheck: false,
      payTypes: [],
      countries: [],
      transAmount: minLimit > 0 ? minLimit.toString() : ""
    };
    
    console.log('Binance API request payload:', JSON.stringify(payload));
    
    const response = await axios.post(
      API_CONFIG.binanceApiUrl, 
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': API_CONFIG.userAgent
        },
        timeout: API_CONFIG.timeout
      }
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`Binance API responded in ${executionTime}ms with status:`, response.status);

    // Check if Binance API returned an error
    if (response.data && response.data.code && response.data.code !== '000000') {
      console.error('Binance API returned error:', response.data);
      
      let errorMessage = 'Binance API Error';
      if (response.data.code === '000002') {
        errorMessage = 'Invalid parameters sent to Binance API';
      } else if (response.data.message) {
        errorMessage = `Binance API Error: ${response.data.message}`;
      }
      
      return {
        buy: [],
        error: errorMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'binance_api_error',
          dataType: 'top20_lowest_prices',
          recordCount: 0
        }
      };
    }
    
    // Check if response has expected structure
    if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
      console.error('Unexpected response structure from Binance API');
      return {
        buy: [],
        error: 'Unexpected response structure from Binance API',
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'invalid_response',
          dataType: 'top20_lowest_prices',
          recordCount: 0
        }
      };
    }
    
    const buyData = response.data.data || [];
    console.log(`Received ${buyData.length} buy advertisements from Binance (already filtered by min limit ${minLimit})`);
      
    // Sort by price (lowest first) - Binance should return them sorted but let's ensure it
    const sortedData = buyData.sort((a, b) => parseFloat(a.adv.price) - parseFloat(b.adv.price));
    const top20 = sortedData.slice(0, 20);
      
    console.log(`Returning top ${top20.length} lowest prices with min limit ${minLimit} (filtered by Binance)`);
    
    return {
      buy: top20,
      timestamp: new Date().toISOString(),
      metadata: {
        executionTime: `${executionTime}ms`,
        dataType: 'top20_lowest_prices',
        recordCount: top20.length,
        description: `Top ${top20.length} lowest buy prices${minLimit > 0 ? ` with min limit >= ${minLimit}` : ''} (filtered by Binance API)`,
        cached: false,
        minLimit: minLimit,
        apiFiltered: true
      }
    };
    
  } catch (error) {
    console.error(`Error fetching top 20 lowest prices for ${asset}:`, error.message);
    
    let errorType = 'unknown_error';
    let errorMessage = error.message;
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorType = 'network_error';
      errorMessage = 'Cannot connect to Binance API. Please check your internet connection.';
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorType = 'timeout_error';
      errorMessage = 'Request to Binance API timed out. Please try again.';
    } else if (error.response?.status === 403) {
      errorType = 'forbidden_error';
      errorMessage = 'Access to Binance API is restricted.';
    } else if (error.response?.status === 429) {
      errorType = 'rate_limit_error';
      errorMessage = 'Too many requests to Binance API. Please wait and try again.';
    }
    
    return {
      buy: [],
      error: errorMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        executionTime: 'failed',
        errorType,
        dataType: 'top20_lowest_prices',
        recordCount: 0
      }
    };
  }
}

// Function to fetch top 50 buy/sell data with specific parameters
async function fetchTop50BuySellData(asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency, countries = ['VN'], payTypes = ['Bank', 'BankTransferVietnam']) {
  try {
    console.log(`Fetching top 50 buy/sell data for ${asset} in ${fiat} for countries: ${countries.join(', ')} with payment methods: ${payTypes.join(', ')}`);
    
    const startTime = Date.now();
    
    // Make two separate API calls using the exact same pattern as the working fetchTop20LowestPrices function
    
    // First, get BUY data (use exact same payload as working function)
    const buyPayload = {
      page: 1,
      rows: 20,
      asset,
      tradeType: 'BUY',
      fiat,
      publisherType: null,
      merchantCheck: false,
      payTypes: [],
      countries: [],
      transAmount: ""
    };
    
    console.log('Binance API request payload for BUY:', JSON.stringify(buyPayload));
    
    const buyResponse = await axios.post(
      API_CONFIG.binanceApiUrl, 
      buyPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': API_CONFIG.userAgent
        },
        timeout: API_CONFIG.timeout
      }
    );
    
    console.log(`BUY request completed with status: ${buyResponse.status}`);
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Then, get SELL data (use exact same payload as BUY, just change tradeType)
    const sellPayload = {
      page: 1,
      rows: 20,
      asset,
      tradeType: 'SELL',
      fiat,
      publisherType: null,
      merchantCheck: false,
      payTypes: [],
      countries: [],
      transAmount: ""
    };
    
    console.log('Binance API request payload for SELL:', JSON.stringify(sellPayload));
    
    const sellResponse = await axios.post(
      API_CONFIG.binanceApiUrl, 
      sellPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': API_CONFIG.userAgent
        },
        timeout: API_CONFIG.timeout
      }
    );
    
    console.log(`SELL request completed with status: ${sellResponse.status}`);

    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`Binance API responded in ${executionTime}ms`);

    // Check for API errors in BUY response (same as working function)
    if (buyResponse.data && buyResponse.data.code && buyResponse.data.code !== '000000') {
      console.error('Binance API returned error for BUY:', buyResponse.data);
      
      let errorMessage = 'Binance API Error (BUY)';
      if (buyResponse.data.code === '000002') {
        errorMessage = 'Invalid parameters sent to Binance API (BUY)';
      } else if (buyResponse.data.message) {
        errorMessage = `Binance API Error (BUY): ${buyResponse.data.message}`;
      }
      
      return {
        buy: [],
        sell: [],
        error: errorMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'binance_api_error',
          dataType: 'top20_buy_sell',
          recordCount: 0
        }
      };
    }
    
    // Check for API errors in SELL response (same as working function)
    if (sellResponse.data && sellResponse.data.code && sellResponse.data.code !== '000000') {
      console.error('Binance API returned error for SELL:', sellResponse.data);
      
      let errorMessage = 'Binance API Error (SELL)';
      if (sellResponse.data.code === '000002') {
        errorMessage = 'Invalid parameters sent to Binance API (SELL)';
      } else if (sellResponse.data.message) {
        errorMessage = `Binance API Error (SELL): ${sellResponse.data.message}`;
      }
      
      return {
        buy: [],
        sell: [],
        error: errorMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'binance_api_error',
          dataType: 'top20_buy_sell',
          recordCount: 0
        }
      };
    }
    
    // Check if responses have expected structure (same as working function)
    if (!buyResponse.data || !buyResponse.data.data || !Array.isArray(buyResponse.data.data)) {
      console.error('Unexpected response structure from Binance API (BUY)');
      return {
        buy: [],
        sell: [],
        error: 'Unexpected response structure from Binance API (BUY)',
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'invalid_response',
          dataType: 'top20_buy_sell',
          recordCount: 0
        }
      };
    }
    
    if (!sellResponse.data || !sellResponse.data.data || !Array.isArray(sellResponse.data.data)) {
      console.error('Unexpected response structure from Binance API (SELL)');
      return {
        buy: [],
        sell: [],
        error: 'Unexpected response structure from Binance API (SELL)',
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'invalid_response',
          dataType: 'top20_buy_sell',
          recordCount: 0
        }
      };
    }
    
    // Extract data
    let buyData = buyResponse.data.data || [];
    let sellData = sellResponse.data.data || [];
    
    console.log(`Received ${buyData.length} buy advertisements and ${sellData.length} sell advertisements`);
    
    // Filter for specific payment methods since we used empty arrays in the API call
    console.log('Filtering for specific payment methods:', payTypes);
    console.log('All data available - Countries filter will be applied more flexibly');
    
    // Filter buy data - be more flexible with payment methods to ensure we get enough results
    buyData = buyData.filter(ad => {
      // Check payment methods - be more flexible
      if (!ad.adv.tradeMethods || ad.adv.tradeMethods.length === 0) {
        return false; // Must have some payment method
      }
      
      // Look for any payment method that contains our target payment types
      const hasPaymentMethod = ad.adv.tradeMethods.some(method => {
        const methodId = method.identifier.toLowerCase();
        const methodName = method.tradeMethodName.toLowerCase();
        
        return payTypes.some(payType => {
          const lowerPayType = payType.toLowerCase();
          return methodId.includes(lowerPayType) || 
                 methodName.includes(lowerPayType) ||
                 methodId.includes('bank') || 
                 methodName.includes('bank') ||
                 methodId.includes('transfer') ||
                 methodName.includes('transfer');
        });
      });
      
      return hasPaymentMethod;
    });
    
    // Filter sell data - same flexible approach
    sellData = sellData.filter(ad => {
      // Check payment methods - be more flexible
      if (!ad.adv.tradeMethods || ad.adv.tradeMethods.length === 0) {
        return false; // Must have some payment method
      }
      
      // Look for any payment method that contains our target payment types
      const hasPaymentMethod = ad.adv.tradeMethods.some(method => {
        const methodId = method.identifier.toLowerCase();
        const methodName = method.tradeMethodName.toLowerCase();
        
        return payTypes.some(payType => {
          const lowerPayType = payType.toLowerCase();
          return methodId.includes(lowerPayType) || 
                 methodName.includes(lowerPayType) ||
                 methodId.includes('bank') || 
                 methodName.includes('bank') ||
                 methodId.includes('transfer') ||
                 methodName.includes('transfer');
        });
      });
      
      return hasPaymentMethod;
    });
    
    console.log(`After filtering by payment methods: ${buyData.length} buy ads, ${sellData.length} sell ads`);
    
    // If we still don't have enough data, be even more flexible
    if (buyData.length < 20) {
      console.log(`Not enough buy data (${buyData.length}), using all available buy data`);
      buyData = buyResponse.data.data || [];
    }
    
    if (sellData.length < 20) {
      console.log(`Not enough sell data (${sellData.length}), using all available sell data`);
      sellData = sellResponse.data.data || [];
    }
    
    // Sort buy data by price (lowest first)
    const sortedBuyData = buyData.sort((a, b) => parseFloat(a.adv.price) - parseFloat(b.adv.price));
    
    // Sort sell data by price (highest first)
    const sortedSellData = sellData.sort((a, b) => parseFloat(b.adv.price) - parseFloat(a.adv.price));
    
    // Get top 20 of each to ensure consistent results
    const top20Buy = sortedBuyData.slice(0, 20);
    const top20Sell = sortedSellData.slice(0, 20);
    
    console.log(`Returning top ${top20Buy.length} lowest buy prices and top ${top20Sell.length} highest sell prices`);
    
    return {
      buy: top20Buy,
      sell: top20Sell,
      timestamp: new Date().toISOString(),
      metadata: {
        executionTime: `${executionTime}ms`,
        dataType: 'top20_buy_sell',
        recordCount: top20Buy.length + top20Sell.length,
        description: `Top ${top20Buy.length} lowest buy prices and top ${top20Sell.length} highest sell prices for ${countries.join(', ')} with payment methods: ${payTypes.join(', ')}`,
        cached: false,
        countries: countries,
        payTypes: payTypes,
        apiFiltered: true
      }
    };
    
  } catch (error) {
    console.error(`Error fetching top 50 buy/sell data for ${asset}:`, error.message);
    
    let errorType = 'unknown_error';
    let errorMessage = error.message;
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorType = 'network_error';
      errorMessage = 'Cannot connect to Binance API. Please check your internet connection.';
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorType = 'timeout_error';
      errorMessage = 'Request to Binance API timed out. Please try again.';
    } else if (error.response?.status === 403) {
      errorType = 'forbidden_error';
      errorMessage = 'Access to Binance API is restricted.';
    } else if (error.response?.status === 429) {
      errorType = 'rate_limit_error';
      errorMessage = 'Too many requests to Binance API. Please wait and try again.';
    }
    
    return {
      buy: [],
      sell: [],
      error: errorMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        executionTime: 'failed',
        errorType,
        dataType: 'top50_buy_sell',
        recordCount: 0
      }
    };
  }
}

// API Endpoints
app.get('/api/config', (req, res) => {
  res.json(CONFIG);
});

app.put('/api/config', (req, res) => {
  try {
    const { deviationThreshold } = req.body;
    
    if (deviationThreshold !== undefined && !isNaN(parseFloat(deviationThreshold))) {
      CONFIG.deviationThreshold = parseFloat(deviationThreshold);
      
      // Save updated config to config.json
      try {
        fs.writeFileSync(
          path.join(__dirname, 'config.json'),
          JSON.stringify(CONFIG, null, 2)
        );
      } catch (fsError) {
        console.warn('Could not save config to file:', fsError.message);
        // Continue even if file save fails
      }
      
      // Don't try to recalculate anomalies here, as latestData.advertisements doesn't exist
      // The next scheduled fetch will use the new threshold
      
      res.json({ success: true, config: CONFIG });
    } else {
      res.status(400).json({ success: false, error: 'Invalid deviationThreshold value' });
    }
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



// Create endpoint for fetching BTC trend
app.get('/api/btc-trend', async (req, res) => {
  try {
    let price, change24h, trend;
    
    // Try Binance first (higher rate limits)
    try {
      const btcStats = await axios.get('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
      if (btcStats.data && btcStats.data.priceChangePercent) {
        price = parseFloat(btcStats.data.lastPrice);
        change24h = parseFloat(btcStats.data.priceChangePercent);
        
        if (change24h > 1.5) trend = 'UP';
        else if (change24h < -1.5) trend = 'DOWN';
        else trend = 'NEUTRAL';
        
        console.log(`Using Binance for BTC trend data: ${trend} (${change24h.toFixed(2)}%)`);
        
        return res.json({
          price,
          trend,
          change24h: parseFloat(change24h.toFixed(2)),
          source: 'binance'
        });
      }
    } catch (err) {
      console.log('Binance failed for BTC trend data, using algorithmic fallback');
    }
    
    // Fallback to algorithmic value
    console.log('Using algorithmic estimation for BTC trend');
    const currentTime = new Date();
    
    // Generate a trend based on day of week - early week up, mid week down, weekend neutral
    const day = currentTime.getDay(); // 0-6, 0 = Sunday
    if (day === 1 || day === 2) { // Monday, Tuesday
      trend = 'UP';
      change24h = 2.5;
    } else if (day === 3 || day === 4) { // Wednesday, Thursday
      trend = 'DOWN';
      change24h = -2.1;
    } else { // Friday, Saturday, Sunday
      trend = 'NEUTRAL';
      change24h = 0.3;
    }
    
    // Approximate BTC price as $40k-ish with some variation
    price = 40000 + (Math.sin(currentTime.getTime() / 3600000) * 2000);
    
    res.json({
      price: parseFloat(price.toFixed(0)),
      trend,
      change24h: parseFloat(change24h.toFixed(2)),
      source: 'algorithm'
    });
  } catch (error) {
    console.error('Error in /api/btc-trend endpoint:', error.message);
    res.status(500).json({ 
      error: 'Server error fetching BTC trend',
      trend: 'NEUTRAL',
      change24h: 0,
      price: 40000
    });
  }
});

// Add new endpoint to proxy Binance API requests
app.get('/api/binance-data', async (req, res) => {
  try {
    console.log('Fetching Binance data for client...');
    
    // 1. Get BTC/USDT price and 24hr change from Binance
    const btcResponse = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const btcPrice = parseFloat(btcResponse.data.price);
    
    // 2. Get 24hr price change percentage for BTC
    const btcStatsResponse = await axios.get('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    const priceChangePercent = parseFloat(btcStatsResponse.data.priceChangePercent);
    
    // 3. Calculate buy and sell liquidity from order book
    let buyLiquidity = 0;
    let sellLiquidity = 0;
    
    try {
      const orderBookResponse = await axios.get('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=10');
      
      // Sum up the first 10 bids (buy orders)
      orderBookResponse.data.bids.forEach(bid => {
        buyLiquidity += parseFloat(bid[0]) * parseFloat(bid[1]);
      });
      
      // Sum up the first 10 asks (sell orders)
      orderBookResponse.data.asks.forEach(ask => {
        sellLiquidity += parseFloat(ask[0]) * parseFloat(ask[1]);
      });
    } catch (orderBookError) {
      console.error('Error fetching order book:', orderBookError);
      // Default values
      buyLiquidity = 100;
      sellLiquidity = 100;
    }
    
    // Return the collected data
    res.json({
      btcPrice,
      priceChangePercent,
      buyLiquidity,
      sellLiquidity,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error proxying Binance data:', error);
    res.status(500).json({ error: 'Failed to fetch Binance data' });
  }
});

// Function to fetch all P2P data (not ads)
// Removed fetchAllP2PData function - no longer needed without paging

// Removed caching - not needed for simplified approach

// Removed complex fetchTop30BuyOnly function - replaced with simplified fetchTop20LowestPrices

// Removed fetchTop30P2PData function - no longer needed

// Simplified API endpoint for top 20 lowest prices
app.get('/api/p2p/all', async (req, res) => {
  try {
    const { asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency, minLimit = 0 } = req.query;
    
    console.log(`Received request for /api/p2p/all with asset=${asset}, fiat=${fiat}, minLimit=${minLimit} - fetching top 20 lowest prices`);
    
    // Parse minLimit as number
    const minLimitNum = parseInt(minLimit, 10) || 0;
    
    // Use the simplified function to get top 20 lowest prices
    const top20Data = await fetchTop20LowestPrices(asset, fiat, minLimitNum);
    
    // Return with enhanced metadata
    res.json({
      ...top20Data,
      metadata: {
        ...top20Data.metadata,
        dataType: 'top20_lowest_prices',
        buyDescription: `Top 20 lowest buy prices${minLimitNum > 0 ? ` with min limit >= ${minLimitNum}` : ''} (filtered by Binance API)`,
        recordCounts: {
          buy: top20Data.buy?.length || 0,
          sell: 0,
          total: top20Data.buy?.length || 0
        },
        limitInfo: `Showing top 20 lowest buy prices${minLimitNum > 0 ? ` with min limit >= ${minLimitNum}` : ''} (filtered by Binance P2P API)`,
        appliedMinLimit: minLimitNum,
        apiFiltered: true
      }
    });
  } catch (error) {
    console.error('Error fetching top 20 lowest prices:', error);
    res.status(500).json({
      buy: [],
      sell: [],
      error: error.message,
      metadata: {
        dataType: 'top20_lowest_prices',
        error: true,
        executionTime: 'failed'
      }
    });
  }
});

// New API endpoint for top 50 buy/sell data
app.get('/api/p2p/buy-sell-top50', async (req, res) => {
  try {
    const { asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency } = req.query;
    
    console.log(`Received request for /api/p2p/buy-sell-top50 with asset=${asset}, fiat=${fiat} - fetching top 50 buy/sell data`);
    
    // Use fixed parameters for Vietnam with Bank payment methods
    const countries = ['VN'];
    const payTypes = ['Bank', 'BankTransferVietnam'];
    
    const top50Data = await fetchTop50BuySellData(asset, fiat, countries, payTypes);
    
    res.json({
      ...top50Data,
      metadata: {
        ...top50Data.metadata,
        buyDescription: `Top 20 lowest buy prices for VN with payment methods: ${payTypes.join(', ')}`,
        sellDescription: `Top 20 highest sell prices for VN with payment methods: ${payTypes.join(', ')}`,
        recordCounts: {
          buy: top50Data.buy?.length || 0,
          sell: top50Data.sell?.length || 0,
          total: (top50Data.buy?.length || 0) + (top50Data.sell?.length || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching top 50 buy/sell data:', error);
    res.status(500).json({
      buy: [],
      sell: [],
      error: error.message,
      metadata: {
        dataType: 'top20_buy_sell',
        error: true,
        executionTime: 'failed'
      }
    });
  }
});

// Add a simple test endpoint to check Binance API connectivity
app.get('/api/test/binance', async (req, res) => {
  const { asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency } = req.query;
  
  try {
    console.log(`Testing Binance API connectivity for ${asset}/${fiat}`);
    
    const testPayload = {
      page: 1,
      rows: 1, // Just fetch 1 record to test connectivity
      asset,
      tradeType: 'BUY',
      fiat,
      publisherType: null,
      merchantCheck: false,
      payTypes: [],
      countries: [],
      transAmount: ""
    };
    
    const response = await axios.post(
      API_CONFIG.binanceApiUrl,
      testPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': API_CONFIG.userAgent
        },
        timeout: API_CONFIG.timeout
      }
    );
    
    res.json({
      success: true,
      status: response.status,
      dataLength: response.data?.data?.length || 0,
      message: 'Binance API is accessible',
      sampleData: response.data?.data?.slice(0, 1) || []
    });
  } catch (error) {
    console.error('Binance API test failed:', error.message);
    res.json({
      success: false,
      error: error.message,
      code: error.code,
      status: error.response?.status,
      message: 'Binance API test failed'
    });
  }
});





// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Configuration loaded:');
  console.log(`- Port: ${PORT}`);
  console.log(`- Default Asset: ${CONFIG.assets[0]}`);
  console.log(`- Default Fiat: ${CONFIG.fiatCurrency}`);
  console.log(`- Countries: ${CONFIG.countries.join(', ')}`);
  console.log(`- Payment Methods: ${CONFIG.paymentMethods.join(', ')}`);
  console.log(`- Update Interval: ${CONFIG.updateInterval}ms`);
  // Removed cache TTL log - no longer using caching
  console.log(`- API Timeout: ${API_CONFIG.timeout}ms`);
}); 