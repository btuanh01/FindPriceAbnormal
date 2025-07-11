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

// Function to format price with proper separators
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(price);
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

// Removed searchAllByAmount function - no longer needed without paging

// Remove the search-all endpoint as we no longer support paging

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
  
  // Start the decision update schedule with a slight delay
  setTimeout(scheduleDecisionUpdate, 5000);
}); 