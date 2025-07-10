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

// Store for latest market decision
let latestDecision = {
  decision: 'HOLD',
  confidence: 'LOW',
  reason: 'Đang khởi động...',
  metrics: {
    avgBuyPrice: null,
    avgSellPrice: null,
    liquidity: null,
    spread: null,
    merchantHealth: null
  },
  timestamp: new Date().toISOString()
};

// Configuration using environment variables
const CONFIG = {
  updateInterval: parseInt(process.env.UPDATE_INTERVAL) || 60000, // 1 minute
  decisionInterval: parseInt(process.env.DECISION_INTERVAL) || 60000, // 1 minute
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

// Function to fetch P2P advertisements
async function fetchP2PAdvertisements(asset, tradeType) {
  try {
    console.log(`Fetching P2P ads for ${asset} (${tradeType}) in Vietnam using VND with payment methods: ${CONFIG.paymentMethods.join(', ')}`);
    
    // Try with specific payment methods
    let payload = {
      page: 1,
      rows: 20,
      asset,
      tradeType,
      fiat: CONFIG.fiatCurrency,
      publisherType: null,
      merchantCheck: false,
      payTypes: CONFIG.paymentMethods,
      countries: CONFIG.countries,
      transAmount: ""
    };
    
    console.log('P2P API request payload (with specific payment methods):', JSON.stringify(payload));
    
    let response = await axios.post(
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

    let adsData = response.data.data || [];
    console.log(`Received ${adsData.length} P2P ads for ${asset} (${tradeType}) with specified payment methods`);

    // If no data with specific payment methods, try with all payment methods
    if (adsData.length === 0) {
      console.log('No ads found with specified payment methods, trying with all payment methods');
      
      payload = {
        page: 1,
        rows: 20,
        asset,
        tradeType,
        fiat: CONFIG.fiatCurrency,
        publisherType: null,
        merchantCheck: false,
        payTypes: [], // No payment method filter
        countries: CONFIG.countries,
        transAmount: ""
      };
      
      console.log('P2P API request payload (all payment methods):', JSON.stringify(payload));
      
      response = await axios.post(
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
      
      adsData = response.data.data || [];
      console.log(`Received ${adsData.length} P2P ads for ${asset} (${tradeType}) with all payment methods`);
      
      // We'll filter for our specific payment methods in the anomaly detection function
    }

    // Log all payment methods found
    if (adsData.length > 0) {
      const allPaymentMethods = new Set();
      adsData.forEach(ad => {
        if (ad.adv.tradeMethods) {
          ad.adv.tradeMethods.forEach(method => {
            allPaymentMethods.add(method.identifier);
          });
        }
      });
      
      console.log('All available payment methods:', Array.from(allPaymentMethods));
      
      if (adsData.length > 0) {
        console.log('Sample ad structure:', JSON.stringify(adsData[0], null, 2).substring(0, 500) + '...');
      }
    } else {
      console.log('P2P API response:', JSON.stringify(response.data, null, 2));
    }
    
    return adsData;
  } catch (error) {
    console.error(`Error fetching P2P ads for ${asset}:`, error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return [];
  }
}

// Function to analyze market data and generate strategic recommendations
async function generateMarketDecision() {
  console.log('Generating market decision...');
  const timestamp = new Date().toISOString();
  
  try {
    // 1. Fetch data for analysis
    const asset = CONFIG.assets[0]; // Use the first asset from config
    
    // Fetch both BUY and SELL advertisements
    const buyAds = await fetchP2PAdvertisements(asset, 'BUY');
    const sellAds = await fetchP2PAdvertisements(asset, 'SELL');
    
    if (!buyAds || !sellAds || buyAds.length === 0 || sellAds.length === 0) {
      return {
        decision: 'HOLD',
        confidence: 'LOW',
        reason: 'Không đủ dữ liệu P2P',
        metrics: {
          avgBuyPrice: null,
          avgSellPrice: null,
          liquidity: null,
          spread: null,
          merchantHealth: null
        },
        timestamp
      };
    }
    
    // 2. Calculate metrics for analysis
    
    // 2.1 Calculate average prices
    let totalBuyPrice = 0;
    let totalSellPrice = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let reliableMerchants = 0;
    let totalMerchants = buyAds.length + sellAds.length;
    
    // Process BUY ads (people buying USDT)
    for (const ad of buyAds) {
      const p2pPrice = parseFloat(ad.adv.price);
      const availableAmount = parseFloat(ad.adv.maxSingleTransAmount);
      
      totalBuyPrice += p2pPrice;
      totalBuyVolume += availableAmount;
      
      // Count reliable merchants (completion rate > 98%)
      if (ad.advertiser.monthFinishRate >= 0.98) {
        reliableMerchants++;
      }
    }
    
    // Process SELL ads (people selling USDT)
    for (const ad of sellAds) {
      const p2pPrice = parseFloat(ad.adv.price);
      const availableAmount = parseFloat(ad.adv.maxSingleTransAmount);
      
      totalSellPrice += p2pPrice;
      totalSellVolume += availableAmount;
      
      // Count reliable merchants (completion rate > 98%)
      if (ad.advertiser.monthFinishRate >= 0.98) {
        reliableMerchants++;
      }
    }
    
    // Calculate averages
    const avgBuyPrice = totalBuyPrice / buyAds.length;
    const avgSellPrice = totalSellPrice / sellAds.length;
    const totalLiquidity = totalBuyVolume + totalSellVolume;
    
    // 2.2 Calculate market spread
    // Get the lowest sell price and highest buy price
    const lowestSellPrice = Math.min(...sellAds.map(ad => parseFloat(ad.adv.price)));
    const highestBuyPrice = Math.max(...buyAds.map(ad => parseFloat(ad.adv.price)));
    const spread = ((lowestSellPrice - highestBuyPrice) / avgBuyPrice) * 100;
    
    // 2.3 Calculate merchant health score
    const merchantHealthScore = (reliableMerchants / totalMerchants) * 100;
    
    // 3. Make decision based on metrics
    let decision = 'HOLD';
    let confidence = 'MEDIUM';
    let reason = '';
    
    // Significant price difference indicating market opportunities
    const priceSpreadThreshold = CONFIG.deviationThreshold; // Use config threshold
    
    // BUY USDT recommendation (if sell prices are low relative to buy prices)
    if (avgSellPrice < avgBuyPrice * 0.995 && 
        totalSellVolume > 5000 && 
        Math.abs(spread) > priceSpreadThreshold) {
      
      decision = 'BUY';
      confidence = (avgBuyPrice - avgSellPrice) / avgBuyPrice > 0.01 ? 'HIGH' : 'MEDIUM';
      reason = 'Giá bán USDT thấp hơn giá mua đáng kể';
    }
    // SELL USDT recommendation (if buy prices are high relative to sell prices)
    else if (avgBuyPrice > avgSellPrice * 1.005 && 
             totalBuyVolume > 5000 && 
             Math.abs(spread) > priceSpreadThreshold) {
      
      decision = 'SELL';
      confidence = (avgBuyPrice - avgSellPrice) / avgSellPrice > 0.01 ? 'HIGH' : 'MEDIUM';
      reason = 'Giá mua USDT cao hơn giá bán đáng kể';
    }
    // HOLD recommendation
    else {
      decision = 'HOLD';
      if (Math.abs(avgBuyPrice - avgSellPrice) / avgBuyPrice < 0.002) {
        reason = 'Thị trường ổn định, không có cơ hội rõ ràng';
        confidence = 'HIGH';
      } else if (totalLiquidity < 5000) {
        reason = 'Thanh khoản thị trường thấp';
        confidence = 'MEDIUM';
      } else {
        reason = 'Điều kiện thị trường chưa rõ ràng';
        confidence = 'LOW';
      }
    }
    
    // 4. Return decision data
    return {
      decision,
      confidence,
      reason,
      metrics: {
        avgBuyPrice: formatPrice(avgBuyPrice),
        avgSellPrice: formatPrice(avgSellPrice),
        priceSpread: ((avgBuyPrice - avgSellPrice) / avgBuyPrice * 100).toFixed(2) + '%',
        liquidity: formatPrice(totalLiquidity),
        buyLiquidity: formatPrice(totalBuyVolume),
        sellLiquidity: formatPrice(totalSellVolume),
        spread: spread.toFixed(2) + '%',
        merchantHealth: merchantHealthScore.toFixed(0) + '%'
      },
      timestamp
    };
  } catch (error) {
    console.error('Error generating market decision:', error);
    return {
      decision: 'HOLD',
      confidence: 'LOW',
      reason: 'Lỗi phân tích thị trường',
      metrics: {
        avgBuyPrice: null,
        avgSellPrice: null,
        liquidity: null,
        spread: null,
        merchantHealth: null
      },
      timestamp
    };
  }
}

// Helper function to format price in VND
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(price);
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

// Diagnostic endpoint to see raw P2P ads
app.get('/api/rawdata', async (req, res) => {
  try {
    const asset = CONFIG.assets[0]; // Use the first asset from config
    const tradeType = req.query.type || 'BUY'; // Default to BUY
    const ads = await fetchP2PAdvertisements(asset, tradeType);
    
    // Extract payment methods
    const paymentMethods = new Set();
    ads.forEach(ad => {
      if (ad.adv.tradeMethods) {
        ad.adv.tradeMethods.forEach(method => {
          paymentMethods.add(method.identifier);
        });
      }
    });
    
    res.json({
      count: ads.length,
      paymentMethods: Array.from(paymentMethods),
      data: ads.slice(0, 5) // Only send first 5 for brevity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for market decision
app.get('/api/decision', async (req, res) => {
  try {
    const decision = await generateMarketDecision();
    res.json(decision);
  } catch (error) {
    console.error('Error in decision endpoint:', error);
    res.status(500).json({ 
      error: 'Không thể tạo quyết định', 
      message: error.message 
    });
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
async function fetchAllP2PData(asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency, page = 1, rows = 20) {
  try {
    console.log(`Fetching all P2P data for ${asset} in ${fiat}, page ${page}, rows ${rows}`);
    
    // Binance API might have limitations on rows parameter, let's set a safe limit
    const safeRows = Math.min(rows, 20); // Limit to 20 per request as Binance might restrict larger requests
    console.log(`Using safe row limit: ${safeRows} (original request: ${rows})`);
    
    // Payload without merchant check or publisherType to get all data
    const payload = {
      page,
      rows: safeRows,
      asset,
      tradeType: 'BUY', // Can be 'BUY' or 'SELL'
      fiat,
      publisherType: null,
      merchantCheck: false,
      payTypes: [],
      countries: [],
      transAmount: ""
    };
    
    console.log('Sending BUY request payload:', JSON.stringify(payload));
    
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

    const data = response.data.data || [];
    console.log(`Received ${data.length} BUY advertisements`);
    
    // Also fetch SELL data
    const sellPayload = {
      ...payload,
      tradeType: 'SELL'
    };
    
    console.log('Sending SELL request payload:', JSON.stringify(sellPayload));
    
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

    const sellData = sellResponse.data.data || [];
    console.log(`Received ${sellData.length} SELL advertisements`);
    
    // To fulfill the original rows request, we might need to make multiple requests
    if (data.length < rows && rows > 20) {
      console.log(`Attempting to fetch more data to meet rows=${rows} request...`);
      // Implementing pagination through multiple requests would go here
      // For now, just indicating that the feature is available but limited
    }
    
    // Combine both datasets
    const result = {
      buy: data,
      sell: sellData,
      timestamp: new Date().toISOString()
    };
    
    console.log(`Total data returned: ${data.length + sellData.length} advertisements`);
    return result;
  } catch (error) {
    console.error(`Error fetching all P2P data for ${asset}:`, error.message);
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    return { buy: [], sell: [], error: error.message };
  }
}

// Cache for ultra-fast responses
const P2P_CACHE = {
  data: null,
  lastFetch: 0,
  ttl: parseInt(process.env.CACHE_TTL) || 5000 // Use environment variable for cache TTL
};

// Super optimized function to fetch ONLY top 30 lowest buy prices (1 API call + caching)
async function fetchTop30BuyOnly(asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency) {
  try {
    const now = Date.now();
    
    // Check cache first - return cached data if fresh (ultra-fast: ~1-5ms)
    if (P2P_CACHE.data && (now - P2P_CACHE.lastFetch) < P2P_CACHE.ttl) {
      console.log(`Returning cached data (${now - P2P_CACHE.lastFetch}ms old) - ultra fast response!`);
      return {
        ...P2P_CACHE.data,
        metadata: {
          ...P2P_CACHE.data.metadata,
          cached: true,
          cacheAge: `${now - P2P_CACHE.lastFetch}ms`,
          executionTime: '~1ms'
        }
      };
    }
    
    console.log(`Fetching fresh data - top 30 lowest BUY prices for ${asset} in ${fiat} (super optimized)`);
    
    const startTime = Date.now();
    
    // Add timeout and better error handling
    const timeoutMs = API_CONFIG.timeout; // Use API_CONFIG timeout
    const payload = {
      page: 1,
      rows: 20, // Reduce from 30 to 20 to avoid "illegal parameter" error
      asset,
      tradeType: 'BUY',
      fiat,
      publisherType: null,
      merchantCheck: false,
      payTypes: [],
      countries: [],
      transAmount: ""
    };
    
    console.log('Sending Binance API request with payload:', JSON.stringify(payload));
    
    // Make API call with timeout
    const buyResponse = await axios.post(
      API_CONFIG.binanceApiUrl,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': API_CONFIG.userAgent
        },
        timeout: timeoutMs
      }
    );

    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`Binance API responded in ${executionTime}ms with status:`, buyResponse.status);
    
    // Check if Binance API returned an error
    if (buyResponse.data && buyResponse.data.code && buyResponse.data.code !== '000000') {
      console.error('Binance API returned error:', buyResponse.data);
      
      let errorMessage = 'Binance API Error';
      if (buyResponse.data.code === '000002') {
        errorMessage = 'Invalid parameters sent to Binance API';
      } else if (buyResponse.data.message) {
        errorMessage = `Binance API Error: ${buyResponse.data.message}`;
      }
      
      return {
        buy: [],
        sell: [],
        error: errorMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'binance_api_error',
          binanceError: {
            code: buyResponse.data.code,
            message: buyResponse.data.message,
            success: buyResponse.data.success
          }
        }
      };
    }
    
    // Check if response has expected structure
    if (!buyResponse.data || !buyResponse.data.data || !Array.isArray(buyResponse.data.data)) {
      console.error('Unexpected response structure from Binance API:');
      console.error('- buyResponse.data exists:', !!buyResponse.data);
      console.error('- buyResponse.data.data exists:', !!buyResponse.data?.data);
      console.error('- buyResponse.data.data is array:', Array.isArray(buyResponse.data?.data));
      console.error('- buyResponse.data.data type:', typeof buyResponse.data?.data);
      console.error('- buyResponse.data keys:', buyResponse.data ? Object.keys(buyResponse.data) : []);
      
      // Log first few characters of response for debugging
      if (buyResponse.data) {
        console.error('- Response sample:', JSON.stringify(buyResponse.data, null, 2).substring(0, 500));
      }
      
      return {
        buy: [],
        sell: [],
        error: 'Unexpected response structure from Binance API',
        timestamp: new Date().toISOString(),
        metadata: {
          executionTime: `${executionTime}ms`,
          errorType: 'invalid_response_structure',
          responseStructure: {
            hasData: !!buyResponse.data,
            hasDataData: !!buyResponse.data?.data,
            isDataArray: Array.isArray(buyResponse.data?.data),
            dataType: typeof buyResponse.data?.data,
            responseKeys: buyResponse.data ? Object.keys(buyResponse.data) : []
          }
        }
      };
    }
    
    const buyData = buyResponse.data.data || [];
    console.log(`Successfully fetched ${buyData.length} buy advertisements`);
    
    const results = {
      buy: buyData.slice(0, 30), // Top 30 lowest buy prices (already sorted)
      sell: [], // No sell data needed
      timestamp: new Date().toISOString(),
      metadata: {
        pagesSearched: 1,
        totalRecordsScanned: buyData.length,
        executionTime: `${executionTime}ms`,
        superOptimized: true,
        description: 'Ultra-fast single API call for buy orders only'
      }
    };
    
    // Update cache only if we got data
    if (buyData.length > 0) {
      P2P_CACHE.data = results;
      P2P_CACHE.lastFetch = now;
      console.log(`Cache updated with ${buyData.length} buy advertisements`);
    }
    
    console.log(`Super optimized top 30 BUY fetch completed in ${executionTime}ms. Found ${results.buy.length} lowest buy prices with 1 API call (${buyData.length} total records)`);
    return results;
  } catch (error) {
    console.error(`Error in super optimized fetchTop30BuyOnly:`, {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Determine error type for better debugging
    let errorType = 'unknown';
    let errorMessage = error.message;
    
    if (error.code === 'ECONNABORTED') {
      errorType = 'timeout';
      errorMessage = 'Request timed out - Binance API not responding';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorType = 'network';
      errorMessage = 'Network error - Cannot reach Binance API';
    } else if (error.response?.status === 429) {
      errorType = 'rate_limit';
      errorMessage = 'Rate limited by Binance API';
    } else if (error.response?.status === 403) {
      errorType = 'forbidden';
      errorMessage = 'Access forbidden by Binance API';
    } else if (error.response?.status >= 500) {
      errorType = 'server_error';
      errorMessage = 'Binance API server error';
    }
    
    return {
      buy: [],
      sell: [],
      error: errorMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        errorType,
        originalError: error.message,
        executionTime: 'failed'
      }
    };
  }
}

// Optimized function to fetch top 30 lowest buy prices with minimal API calls
async function fetchTop30P2PData(asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency) {
  try {
    console.log(`Fetching top 30 P2P data for ${asset} in ${fiat} (optimized)`);
    
    const startTime = Date.now();
    
    // Make 2 concurrent API calls for BUY and SELL orders
    const [buyResponse, sellResponse] = await Promise.all([
      axios.post(API_CONFIG.binanceApiUrl, {
        page: 1,
        rows: 30,
        asset,
        tradeType: 'BUY',
        fiat,
        publisherType: null,
        merchantCheck: false,
        payTypes: [],
        countries: [],
        transAmount: ""
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': API_CONFIG.userAgent
        },
        timeout: API_CONFIG.timeout
      }),
      axios.post(API_CONFIG.binanceApiUrl, {
        page: 1,
        rows: 30,
        asset,
        tradeType: 'SELL',
        fiat,
        publisherType: null,
        merchantCheck: false,
        payTypes: [],
        countries: [],
        transAmount: ""
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': API_CONFIG.userAgent
        },
        timeout: API_CONFIG.timeout
      })
    ]);

    const buyData = buyResponse.data.data || [];
    const sellData = sellResponse.data.data || [];
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    const results = {
      buy: buyData.slice(0, 30), // Top 30 lowest buy prices (already sorted)
      sell: sellData.slice(0, 30), // Top 30 highest sell prices (already sorted)
      timestamp: new Date().toISOString(),
      metadata: {
        pagesSearched: 2,
        totalRecordsScanned: buyData.length + sellData.length,
        executionTime: `${executionTime}ms`,
        optimized: true,
        description: 'Fast concurrent API calls for both buy and sell orders'
      }
    };
    
    console.log(`Optimized top 30 fetch completed in ${executionTime}ms. Found ${results.buy.length} lowest BUY prices and ${results.sell.length} highest SELL prices with only 2 API calls`);
    return results;
  } catch (error) {
    console.error(`Error in optimized fetchTop30P2PData:`, error);
    return { buy: [], sell: [], error: error.message };
  }
}

// Add API endpoint for all P2P data - now returns top 30 lowest buy and top 30 highest sell
app.get('/api/p2p/all', async (req, res) => {
  try {
    const { asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency, onlyBuy } = req.query;
    const isOnlyBuy = onlyBuy === 'true';
    
    console.log(`Received request for /api/p2p/all with asset=${asset}, fiat=${fiat} - fetching top 30 ${isOnlyBuy ? 'buy only' : 'of each type'}`);
    
    // Use the appropriate optimized function
    const top30Data = isOnlyBuy ? await fetchTop30BuyOnly(asset, fiat) : await fetchTop30P2PData(asset, fiat);
    
    // Return with enhanced metadata
    res.json({
      ...top30Data,
      metadata: {
        ...top30Data.metadata,
        dataType: 'top30',
        buyDescription: 'Top 30 lowest buy prices',
        sellDescription: 'Top 30 highest sell prices',
        recordCounts: {
          buy: top30Data.buy?.length || 0,
          sell: top30Data.sell?.length || 0,
          total: (top30Data.buy?.length || 0) + (top30Data.sell?.length || 0)
        },
        limitInfo: `Showing top 30 lowest buy prices${top30Data.metadata?.superOptimized ? '' : ' and top 30 highest sell prices'} (${top30Data.metadata?.superOptimized ? 'super optimized - 1 API call' : top30Data.metadata?.optimized ? 'optimized - 2 concurrent API calls' : 'standard fetch'})`
      }
    });
  } catch (error) {
    console.error('Error fetching top 30 P2P data:', error);
    res.status(500).json({
      buy: [],
      sell: [],
      error: error.message,
      metadata: {
        dataType: 'top30',
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

// Scheduled task to update market decision
async function scheduleDecisionUpdate() {
  try {
    const decision = await generateMarketDecision();
    latestDecision = decision;
    
    console.log(`Market decision updated: ${decision.decision} (${decision.confidence})`);
  } catch (error) {
    console.error('Error updating market decision:', error);
  }
  
  // Schedule next update
  setTimeout(scheduleDecisionUpdate, CONFIG.decisionInterval);
}

// Function to search across multiple pages by transaction amount
async function searchAllByAmount(asset = CONFIG.assets[0], fiat = CONFIG.fiatCurrency, options = {}) {
  try {
    // Extract options - supports single amount or range (fromAmount/toAmount)
    const { amount, fromAmount, toAmount } = options;
    
    // Log what we're searching for
    if (amount) {
      console.log(`Searching across all pages for ${asset} in ${fiat} with exact transaction amount ${amount}`);
    } else if (fromAmount && toAmount) {
      console.log(`Searching across all pages for ${asset} in ${fiat} with transaction amount range from ${fromAmount} to ${toAmount}`);
    } else if (fromAmount) {
      console.log(`Searching across all pages for ${asset} in ${fiat} with minimum transaction amount ${fromAmount}`);
    } else if (toAmount) {
      console.log(`Searching across all pages for ${asset} in ${fiat} with maximum transaction amount ${toAmount}`);
    } else {
      throw new Error('No valid search criteria provided');
    }
    
    // Parse amounts to ensure they're valid numbers
    const parsedAmount = amount ? parseFloat(amount) : null;
    const parsedFromAmount = fromAmount ? parseFloat(fromAmount) : null;
    const parsedToAmount = toAmount ? parseFloat(toAmount) : null;
    
    // Validate numbers
    if ((amount && isNaN(parsedAmount)) || 
        (fromAmount && isNaN(parsedFromAmount)) || 
        (toAmount && isNaN(parsedToAmount))) {
      throw new Error('Invalid transaction amount values');
    }
    
    // Determine search criteria for metadata
    let searchCriteria = '';
    let searchType = '';
    let searchValue = null;
    
    if (parsedAmount) {
      searchCriteria = `Transaction amount: ${parsedAmount} ${fiat}`;
      searchType = 'exact-amount';
      searchValue = parsedAmount;
    } else if (parsedFromAmount && parsedToAmount) {
      searchCriteria = `Transaction amount range: ${parsedFromAmount} - ${parsedToAmount} ${fiat}`;
      searchType = 'amount-range';
      searchValue = { from: parsedFromAmount, to: parsedToAmount };
    } else if (parsedFromAmount) {
      searchCriteria = `Minimum transaction amount: ${parsedFromAmount} ${fiat}`;
      searchType = 'min-amount';
      searchValue = parsedFromAmount;
    } else if (parsedToAmount) {
      searchCriteria = `Maximum transaction amount: ${parsedToAmount} ${fiat}`;
      searchType = 'max-amount';
      searchValue = parsedToAmount;
    }
    
    // Results container
    const allResults = {
      buy: [],
      sell: [],
      timestamp: new Date().toISOString(),
      metadata: {
        searchType,
        searchValue,
        searchCriteria,
        pagesSearched: 0,
        totalRecordsScanned: 0
      }
    };
    
    // How many pages to search (maximum)
    const MAX_PAGES = 5;
    
    // Function to filter listings based on amount criteria
    const filterByAmount = (item) => {
      const minLimit = parseFloat(item.adv.minSingleTransAmount);
      const maxLimit = parseFloat(item.adv.maxSingleTransAmount);
      
      // If using exact amount
      if (parsedAmount) {
        return parsedAmount >= minLimit && parsedAmount <= maxLimit;
      }
      
      // If using range filter - check for overlap between ranges
      if (parsedFromAmount && parsedToAmount) {
        // Check if there's any overlap between the item's range and our filter range
        return (
          // Item's min is within our range
          (minLimit >= parsedFromAmount && minLimit <= parsedToAmount) ||
          // Item's max is within our range
          (maxLimit >= parsedFromAmount && maxLimit <= parsedToAmount) ||
          // Our range is completely within item's range
          (parsedFromAmount >= minLimit && parsedToAmount <= maxLimit)
        );
      }
      
      // If only using minimum amount
      if (parsedFromAmount) {
        // Item's max limit must be >= our min amount
        return maxLimit >= parsedFromAmount;
      }
      
      // If only using maximum amount
      if (parsedToAmount) {
        // Item's min limit must be <= our max amount
        return minLimit <= parsedToAmount;
      }
      
      // Default case (should not reach here if validation is correct)
      return false;
    };
    
    // Search in BUY advertisements
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const pageData = await fetchAllP2PData(asset, fiat, page, 20);
        allResults.metadata.pagesSearched++;
        
        if (pageData.buy && pageData.buy.length > 0) {
          allResults.metadata.totalRecordsScanned += pageData.buy.length;
          
          // Filter by transaction amount criteria
          const filteredBuyData = pageData.buy.filter(filterByAmount);
          
          // Add filtered data to results
          allResults.buy = [...allResults.buy, ...filteredBuyData];
          
          // If we have enough results or no more data, stop searching
          if (pageData.buy.length < 20 || allResults.buy.length >= 100) {
            break;
          }
        } else {
          // No data for this page, stop searching
          break;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error searching BUY page ${page}:`, error.message);
        // Continue with next page despite errors
      }
    }
    
    // Search in SELL advertisements
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const pageData = await fetchAllP2PData(asset, fiat, page, 20);
        
        if (pageData.sell && pageData.sell.length > 0) {
          allResults.metadata.totalRecordsScanned += pageData.sell.length;
          
          // Filter by transaction amount criteria
          const filteredSellData = pageData.sell.filter(filterByAmount);
          
          // Add filtered data to results
          allResults.sell = [...allResults.sell, ...filteredSellData];
          
          // If we have enough results or no more data, stop searching
          if (pageData.sell.length < 20 || allResults.sell.length >= 100) {
            break;
          }
        } else {
          // No data for this page, stop searching
          break;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error searching SELL page ${page}:`, error.message);
        // Continue with next page despite errors
      }
    }
    
    // Sort results by price
    allResults.buy.sort((a, b) => parseFloat(a.adv.price) - parseFloat(b.adv.price));
    allResults.sell.sort((a, b) => parseFloat(b.adv.price) - parseFloat(a.adv.price));
    
    // Limit results to prevent overwhelming the client
    if (allResults.buy.length > 100) allResults.buy = allResults.buy.slice(0, 100);
    if (allResults.sell.length > 100) allResults.sell = allResults.sell.slice(0, 100);
    
    console.log(`Search completed. Found ${allResults.buy.length} BUY and ${allResults.sell.length} SELL matches across ${allResults.metadata.pagesSearched} pages`);
    
    return allResults;
  } catch (error) {
    console.error(`Error in searchAllByAmount:`, error);
    throw error;
  }
}

// API endpoint for searching across all pages by transaction amount
app.get('/api/p2p/search-all', async (req, res) => {
  const asset = req.query.asset || CONFIG.assets[0];
  const fiat = req.query.fiat || CONFIG.fiatCurrency;
  const amount = req.query.amount;
  const fromAmount = req.query.fromAmount;
  const toAmount = req.query.toAmount;
  
  console.log(`Received request for /api/p2p/search-all with asset=${asset}, fiat=${fiat}, amount=${amount}, fromAmount=${fromAmount}, toAmount=${toAmount}`);
  
  // Validate that we have at least one of the required parameters
  if (!amount && !fromAmount && !toAmount) {
    return res.status(400).json({
      error: 'Missing required parameters: either amount, fromAmount, or toAmount must be provided',
      buy: [],
      sell: [],
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const searchResults = await searchAllByAmount(asset, fiat, { amount, fromAmount, toAmount });
    
    // Add extra metadata
    const responseData = {
      ...searchResults,
      metadata: {
        ...searchResults.metadata,
        actualRows: {
          buy: searchResults.buy.length,
          sell: searchResults.sell.length,
          total: searchResults.buy.length + searchResults.sell.length
        }
      }
    };
    
    // Log response summary
    console.log(`Search-all response summary: Found ${responseData.metadata.actualRows.total} total records (${responseData.metadata.actualRows.buy} buy, ${responseData.metadata.actualRows.sell} sell) across ${responseData.metadata.pagesSearched} pages`);
    
    res.json(responseData);
  } catch (error) {
    console.error('Error in search-all:', error);
    
    // Send a structured error response
    res.status(500).json({ 
      error: 'Failed to search across pages', 
      message: error.message,
      timestamp: new Date().toISOString(),
      buy: [], 
      sell: [],
      metadata: {
        searchType: amount ? 'amount' : 'amount-range',
        searchValue: amount || { from: fromAmount, to: toAmount },
        error: true,
        errorDetails: error.message
      }
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
  console.log(`- Cache TTL: ${P2P_CACHE.ttl}ms`);
  console.log(`- API Timeout: ${API_CONFIG.timeout}ms`);
  
  // Start the decision update schedule with a slight delay
  setTimeout(scheduleDecisionUpdate, 5000);
}); 