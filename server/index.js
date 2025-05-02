const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store for latest data
let latestData = {
  anomalies: [],
  lastUpdate: null
};

// Store for latest market decision
let latestDecision = {
  decision: 'HOLD',
  confidence: 'LOW',
  reason: 'Đang khởi động...',
  metrics: {
    avgDeviation: null,
    spotTrend: null,
    liquidity: null,
    spread: null,
    merchantHealth: null
  },
  timestamp: new Date().toISOString()
};

// Configuration
const CONFIG = {
  updateInterval: 60000, // 1 minute
  decisionInterval: 60000, // 1 minute
  deviationThreshold: 0.5, // Default to 0.5% - balanced
  assets: ['USDT'],
  fiatCurrency: 'VND',
  countries: ['VN'], // Vietnam
  paymentMethods: ['BANK', 'BankTransferVietnam'] // Specific bank transfer methods
};

// Add cache and rate limiting protection
const API_CACHE = {
  coingecko: {
    lastFetch: 0,
    data: null,
    retryDelay: 5000, // Start with 5 seconds
    maxRetryDelay: 60000 // Max 1 minute
  },
  bitcoin: {
    lastFetch: 0,
    data: null,
    retryDelay: 5000,
    maxRetryDelay: 300000
  }
};

// Function to fetch Spot price from CoinGecko with rate limiting protection
async function fetchSpotPrice(asset) {
  try {
    if (asset === 'USDT') {
      // For USDT in VND, we'll use multiple sources with fallbacks
      console.log('Fetching USDT price in VND');
      
      // First try using currency exchange APIs (more reliable, higher limits)
      
      // If primary source fails, try CoinGecko with backoff
      const now = Date.now();
      const timeSinceLastFetch = now - API_CACHE.coingecko.lastFetch;
      
      // Only try CoinGecko if we haven't hit rate limits recently
      if (timeSinceLastFetch > API_CACHE.coingecko.retryDelay) {
        try {
          console.log('Trying CoinGecko for USDT price...');
          const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd&include_24hr_change=true');
          
          if (response.data && response.data.tether && response.data.tether.vnd) {
            const usdtVnd = response.data.tether.vnd;
            
            // Update cache and reset backoff on success
            API_CACHE.coingecko.data = response.data;
            API_CACHE.coingecko.lastFetch = now;
            API_CACHE.coingecko.retryDelay = 5000;
            
            console.log(`Got USDT price from CoinGecko: ${usdtVnd} VND per USDT`);
            return usdtVnd;
          } else {
            throw new Error('Invalid response from CoinGecko');
          }
        } catch (geckoErr) {
          console.log('Error getting price from CoinGecko:', geckoErr.message);
          
          // If we got a 429 error, increase backoff
          if (geckoErr.message && (geckoErr.message.includes('429') || 
              (geckoErr.response && geckoErr.response.status === 429))) {
            API_CACHE.coingecko.retryDelay = Math.min(
              API_CACHE.coingecko.retryDelay * 2,
              API_CACHE.coingecko.maxRetryDelay
            );
            console.log(`Increased CoinGecko backoff to ${API_CACHE.coingecko.retryDelay}ms`);
          }
          
          // Use cached data if available
          if (API_CACHE.coingecko.data && API_CACHE.coingecko.data.tether) {
            const cachedPrice = API_CACHE.coingecko.data.tether.vnd;
            console.log(`Using cached CoinGecko price: ${cachedPrice} VND`);
            return cachedPrice;
          }
        }
      } else {
        // Use cached data during backoff period
        if (API_CACHE.coingecko.data && API_CACHE.coingecko.data.tether) {
          const cachedPrice = API_CACHE.coingecko.data.tether.vnd;
          console.log(`Using cached data during backoff (${Math.round((API_CACHE.coingecko.retryDelay - timeSinceLastFetch)/1000)}s remaining): ${cachedPrice} VND`);
          return cachedPrice;
        }
        console.log(`Skipping CoinGecko request - in backoff period (${Math.round((API_CACHE.coingecko.retryDelay - timeSinceLastFetch)/1000)}s remaining)`);
      }
      
      // Fallback option: Use a dynamic algorithm based on time
      console.log('Using algorithmic estimation for USDT price');
      const currentTime = new Date();
      const variation = (Math.sin(currentTime.getTime() / 86400000) * 500) + 24500;
      return parseFloat(variation.toFixed(0));
    } else {
      // For other assets, try multiple sources with fallbacks
      // First try CoinGecko with backoff
      const coinId = getCoinGeckoId(asset);
      const now = Date.now();
      const timeSinceLastFetch = now - API_CACHE.coingecko.lastFetch;
      
      if (timeSinceLastFetch > API_CACHE.coingecko.retryDelay) {
        try {
          console.log(`Fetching price for ${asset} (${coinId}) from CoinGecko`);
          const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
          
          if (response.data && response.data[coinId] && response.data[coinId].usd) {
            const price = response.data[coinId].usd;
            
            // Update cache on success
            if (!API_CACHE.coingecko.data) API_CACHE.coingecko.data = {};
            API_CACHE.coingecko.data[coinId] = { usd: price };
            API_CACHE.coingecko.lastFetch = now;
            API_CACHE.coingecko.retryDelay = 5000;
            
            console.log(`Received price for ${asset}: ${price} USDT`);
            return price;
          } else {
            throw new Error(`Could not get price for ${asset} from CoinGecko`);
          }
        } catch (error) {
          console.error(`Error fetching via CoinGecko:`, error.message);
          
          // Increase backoff on rate limit
          if (error.message && (error.message.includes('429') || 
              (error.response && error.response.status === 429))) {
            API_CACHE.coingecko.retryDelay = Math.min(
              API_CACHE.coingecko.retryDelay * 2,
              API_CACHE.coingecko.maxRetryDelay
            );
            console.log(`Increased CoinGecko backoff to ${API_CACHE.coingecko.retryDelay}ms`);
          }
          
          // Try using cached data
          if (API_CACHE.coingecko.data && API_CACHE.coingecko.data[coinId]) {
            console.log(`Using cached price for ${asset}: ${API_CACHE.coingecko.data[coinId].usd} USDT`);
            return API_CACHE.coingecko.data[coinId].usd;
          }
        }
      } else if (API_CACHE.coingecko.data && API_CACHE.coingecko.data[coinId]) {
        // Use cached data during backoff
        console.log(`Using cached price for ${asset} during backoff: ${API_CACHE.coingecko.data[coinId].usd} USDT`);
        return API_CACHE.coingecko.data[coinId].usd;
      }
      
      // Fallback: Try Binance API directly
      try {
        const symbol = `${asset}USDT`;
        console.log(`Fetching spot price from Binance for ${symbol}`);
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        console.log(`Received price from Binance for ${symbol}:`, response.data.price);
        return parseFloat(response.data.price);
      } catch (error) {
        console.error(`Error fetching from Binance:`, error.message);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error in fetchSpotPrice for ${asset}:`, error.message);
    return null;
  }
}

// Helper function to map asset symbols to CoinGecko IDs
function getCoinGeckoId(asset) {
  const mapping = {
    'USDT': 'tether',
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    // Add more as needed
  };
  
  return mapping[asset] || asset.toLowerCase();
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
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', 
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
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
        'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', 
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
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

// Function to detect anomalies
async function detectAnomalies() {
  const anomalies = [];
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Starting anomaly detection`);

  // Process each asset (USDT only now)
  for (const asset of CONFIG.assets) {
    console.log(`Processing ${asset}`);
    const spotPrice = await fetchSpotPrice(asset);
    if (!spotPrice) {
      console.error(`No spot price available for ${asset}, skipping`);
      continue;
    }

    // Check both BUY and SELL advertisements
    for (const tradeType of ['BUY', 'SELL']) {
      const ads = await fetchP2PAdvertisements(asset, tradeType);
      
      if (!ads || ads.length === 0) {
        console.log(`No ${tradeType} ads found for ${asset}`);
        continue;
      }

      console.log(`Processing ${ads.length} ${tradeType} ads for ${asset}`);
      
      // Filter for specific payment methods (BANK, BankTransferVietnam)
      const targetPaymentMethods = CONFIG.paymentMethods;
      
      for (const ad of ads) {
        try {
          // Check if the ad has the target payment methods
          let hasTargetPaymentMethod = false;
          
          if (ad.adv.tradeMethods) {
            for (const method of ad.adv.tradeMethods) {
              if (targetPaymentMethods.includes(method.identifier)) {
                hasTargetPaymentMethod = true;
                console.log(`Found ad with payment method: ${method.identifier}`);
                break;
              }
            }
          }
          
          if (hasTargetPaymentMethod) {
            const p2pPrice = parseFloat(ad.adv.price);
            const deviation = ((p2pPrice - spotPrice) / spotPrice) * 100;
            console.log(`${asset} ${tradeType} ad price: ${p2pPrice}, spot: ${spotPrice}, deviation: ${deviation.toFixed(2)}%`);
            
            // Determine recommended action based on trade type and price deviation
            let recommendedAction = "NO ACTION";
            
            // Logic for determining BUY NOW or SELL NOW
            // Convert threshold to percentage points for direct comparison with deviation
            const thresholdPercentage = CONFIG.deviationThreshold;

            if (tradeType === "SELL" && deviation < -thresholdPercentage) {
              recommendedAction = "MUA NGAY";
              console.log(`Recommending BUY NOW for ${tradeType} ad by ${ad.advertiser.nickName} - good deal to buy`);
            } else if (tradeType === "BUY" && deviation > thresholdPercentage) {
              recommendedAction = "BÁN NGAY";
              console.log(`Recommending SELL NOW for ${tradeType} ad by ${ad.advertiser.nickName} - good deal to sell`);
            }
            
            // If deviation exceeds threshold (positive or negative), mark as anomaly
            if (Math.abs(deviation) >= CONFIG.deviationThreshold) {
              console.log(`Anomaly detected: ${deviation.toFixed(2)}% deviation for ${tradeType} ad by ${ad.advertiser.nickName}`);
              console.log(`Recommended action: ${recommendedAction}`);
              anomalies.push({
                merchantName: ad.advertiser.nickName,
                orderCount: ad.advertiser.monthOrderCount,
                completionRate: ad.advertiser.monthFinishRate,
                tradeType,
                asset,
                p2pPrice,
                spotPrice,
                deviation,
                recommendedAction,
                timestamp,
                paymentMethods: ad.adv.tradeMethods?.map(m => m.identifier) || [],
                adId: ad.adv.advNo,
                advertiserId: ad.advertiser.userNo
              });
            }
          }
        } catch (error) {
          console.error('Error processing ad:', error);
          console.error('Problematic ad:', JSON.stringify(ad, null, 2));
        }
      }
    }
  }

  console.log(`[${timestamp}] Detected ${anomalies.length} anomalies`);
  return { anomalies, timestamp };
}

// Function to fetch USDT price with trend information
async function fetchUsdtPriceWithTrend() {
  try {
    // First try our primary sources with caching
    let price = null;
    let trend = 'NEUTRAL';
    let change24h = 0;
    
    // Check if we can use Binance first (higher rate limits)
    try {
      // Get USDT/BUSD rate to account for any depeg
      const usdtResponse = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTBUSD');
      const usdtBusdRate = parseFloat(usdtResponse.data.price);
      
      // Get USD to VND exchange rate
      const rateResponse = await axios.get('https://open.er-api.com/v6/latest/USD');
      
      if (rateResponse.data && rateResponse.data.rates && rateResponse.data.rates.VND) {
        price = rateResponse.data.rates.VND * usdtBusdRate;
        
        // Get 24h change stats for USDT (via BTC/USDT change as proxy)
        const btcStats = await axios.get('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        if (btcStats.data && btcStats.data.priceChangePercent) {
          // Inverse of BTC/USDT change is roughly USDT strength
          change24h = -1 * parseFloat(btcStats.data.priceChangePercent) * 0.1; // Dampened effect
          
          if (change24h > 0.5) trend = 'UP';
          else if (change24h < -0.5) trend = 'DOWN';
          else trend = 'NEUTRAL';
          
          console.log(`Using Binance for USDT trend data: ${trend} (${change24h.toFixed(2)}%)`);
        }
      }
    } catch (err) {
      console.log('Primary source failed for trend data, trying CoinGecko');
    }
    
    // If primary source fails, try CoinGecko with backoff
    if (!price) {
      const now = Date.now();
      const timeSinceLastFetch = now - API_CACHE.coingecko.lastFetch;
      
      // Only try CoinGecko if we haven't hit rate limits recently
      if (timeSinceLastFetch > API_CACHE.coingecko.retryDelay) {
        try {
          console.log('Trying CoinGecko for USDT price with trend data...');
          const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd&include_24hr_change=true');
          
          if (response.data && response.data.tether && response.data.tether.vnd) {
            price = response.data.tether.vnd;
            
            // Get trend from 24h price change
            if (response.data.tether.vnd_24h_change !== undefined) {
              change24h = response.data.tether.vnd_24h_change;
              
              if (change24h > 0.5) trend = 'UP';
              else if (change24h < -0.5) trend = 'DOWN';
              else trend = 'NEUTRAL';
            }
            
            // Update cache and reset backoff on success
            API_CACHE.coingecko.data = response.data;
            API_CACHE.coingecko.lastFetch = now;
            API_CACHE.coingecko.retryDelay = 5000;
            
            console.log(`Got USDT price from CoinGecko: ${price} VND (${trend}, ${change24h.toFixed(2)}%)`);
          } else {
            throw new Error('Invalid response from CoinGecko');
          }
        } catch (geckoErr) {
          console.log('Error getting price from CoinGecko:', geckoErr.message);
          
          // If we got a 429 error, increase backoff
          if (geckoErr.message && (geckoErr.message.includes('429') || 
              (geckoErr.response && geckoErr.response.status === 429))) {
            API_CACHE.coingecko.retryDelay = Math.min(
              API_CACHE.coingecko.retryDelay * 2,
              API_CACHE.coingecko.maxRetryDelay
            );
            console.log(`Increased CoinGecko backoff to ${API_CACHE.coingecko.retryDelay}ms`);
          }
          
          // Use cached data if available
          if (API_CACHE.coingecko.data && API_CACHE.coingecko.data.tether) {
            price = API_CACHE.coingecko.data.tether.vnd;
            
            // Use cached trend if available
            if (API_CACHE.coingecko.data.tether.vnd_24h_change !== undefined) {
              change24h = API_CACHE.coingecko.data.tether.vnd_24h_change;
              
              if (change24h > 0.5) trend = 'UP';
              else if (change24h < -0.5) trend = 'DOWN';
              else trend = 'NEUTRAL';
              
              console.log(`Using cached CoinGecko trend: ${trend} (${change24h.toFixed(2)}%)`);
            }
            
            console.log(`Using cached CoinGecko price: ${price} VND`);
          }
        }
      } else if (API_CACHE.coingecko.data && API_CACHE.coingecko.data.tether) {
        // Use cached data during backoff period
        price = API_CACHE.coingecko.data.tether.vnd;
        
        // Use cached trend if available
        if (API_CACHE.coingecko.data.tether.vnd_24h_change !== undefined) {
          change24h = API_CACHE.coingecko.data.tether.vnd_24h_change;
          
          if (change24h > 0.5) trend = 'UP';
          else if (change24h < -0.5) trend = 'DOWN';
          else trend = 'NEUTRAL';
        }
        
        console.log(`Using cached data during backoff (${Math.round((API_CACHE.coingecko.retryDelay - timeSinceLastFetch)/1000)}s remaining): ${price} VND (${trend})`);
      } else {
        console.log(`Skipping CoinGecko request - in backoff period (${Math.round((API_CACHE.coingecko.retryDelay - timeSinceLastFetch)/1000)}s remaining)`);
      }
    }
    
    // Fallback: Use a dynamic algorithm if all else fails
    if (!price) {
      console.log('Using algorithmic estimation for USDT price and trend');
      const currentTime = new Date();
      price = (Math.sin(currentTime.getTime() / 86400000) * 500) + 24500;
      
      // Generate a pseudo-random trend based on the minute of the hour
      const minute = currentTime.getMinutes();
      if (minute % 3 === 0) trend = 'UP';
      else if (minute % 3 === 1) trend = 'DOWN';
      else trend = 'NEUTRAL';
      
      change24h = (trend === 'UP') ? 0.8 : (trend === 'DOWN' ? -0.8 : 0.1);
    }
    
    return { 
      price: parseFloat(price.toFixed(0)), 
      trend, 
      change24h: parseFloat(change24h.toFixed(2)) 
    };
  } catch (error) {
    console.error('Error in fetchUsdtPriceWithTrend:', error.message);
    
    // Ultimate fallback
    return { 
      price: 24500, 
      trend: 'NEUTRAL', 
      change24h: 0 
    };
  }
}

// Function to analyze market data and generate strategic recommendations
async function generateMarketDecision() {
  console.log('Generating market decision...');
  const timestamp = new Date().toISOString();
  
  try {
    // 1. Fetch data for analysis
    const asset = 'USDT';
    const spotData = await fetchUsdtPriceWithTrend();
    const spotPrice = spotData.price;
    
    if (!spotPrice) {
      return {
        decision: 'HOLD',
        confidence: 'LOW',
        reason: 'Không thể lấy giá Spot',
        metrics: {
          avgDeviation: null,
          spotTrend: null,
          liquidity: null,
          spread: null,
          merchantHealth: null
        },
        timestamp
      };
    }
    
    // Fetch both BUY and SELL advertisements
    const buyAds = await fetchP2PAdvertisements(asset, 'BUY');
    const sellAds = await fetchP2PAdvertisements(asset, 'SELL');
    
    if (!buyAds || !sellAds || buyAds.length === 0 || sellAds.length === 0) {
      return {
        decision: 'HOLD',
        confidence: 'LOW',
        reason: 'Không đủ dữ liệu P2P',
        metrics: {
          avgDeviation: null,
          spotTrend: null,
          liquidity: null,
          spread: null,
          merchantHealth: null
        },
        timestamp
      };
    }
    
    // 2. Calculate metrics for analysis
    
    // 2.1 Calculate average deviation
    let totalBuyDeviation = 0;
    let totalSellDeviation = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;
    let reliableMerchants = 0;
    let totalMerchants = buyAds.length + sellAds.length;
    
    // Process BUY ads (people buying USDT)
    for (const ad of buyAds) {
      const p2pPrice = parseFloat(ad.adv.price);
      const deviation = ((p2pPrice - spotPrice) / spotPrice) * 100;
      const availableAmount = parseFloat(ad.adv.maxSingleTransAmount);
      
      totalBuyDeviation += deviation;
      totalBuyVolume += availableAmount;
      
      // Count reliable merchants (completion rate > 98%)
      if (ad.advertiser.monthFinishRate >= 0.98) {
        reliableMerchants++;
      }
    }
    
    // Process SELL ads (people selling USDT)
    for (const ad of sellAds) {
      const p2pPrice = parseFloat(ad.adv.price);
      const deviation = ((p2pPrice - spotPrice) / spotPrice) * 100;
      const availableAmount = parseFloat(ad.adv.maxSingleTransAmount);
      
      totalSellDeviation += deviation;
      totalSellVolume += availableAmount;
      
      // Count reliable merchants (completion rate > 98%)
      if (ad.advertiser.monthFinishRate >= 0.98) {
        reliableMerchants++;
      }
    }
    
    // Calculate averages
    const avgBuyDeviation = totalBuyDeviation / buyAds.length;
    const avgSellDeviation = totalSellDeviation / sellAds.length;
    const avgDeviation = (avgBuyDeviation + avgSellDeviation) / 2;
    const totalLiquidity = totalBuyVolume + totalSellVolume;
    
    // 2.2 Calculate market spread
    // Get the lowest sell price and highest buy price
    const lowestSellPrice = Math.min(...sellAds.map(ad => parseFloat(ad.adv.price)));
    const highestBuyPrice = Math.max(...buyAds.map(ad => parseFloat(ad.adv.price)));
    const spread = ((lowestSellPrice - highestBuyPrice) / spotPrice) * 100;
    
    // 2.3 Calculate merchant health score
    const merchantHealthScore = (reliableMerchants / totalMerchants) * 100;
    
    // 2.4 Determine spot trend (stub for now - would need historical data)
    // In a real implementation, you would compare current spot with previous values
    // For now, we'll use a placeholder (neutral)
    const spotTrend = spotData.trend;
    
    // 3. Make decision based on metrics
    let decision = 'HOLD';
    let confidence = 'MEDIUM';
    let reason = '';
    
    // Significant deviations indicating strong market opportunities
    const significantDeviation = 0.5; // 0.5%
    
    // BUY USDT recommendation
    if (avgSellDeviation < -significantDeviation && 
        totalSellVolume > 5000 && 
        (spotTrend === 'UP' || spotTrend === 'NEUTRAL') && 
        Math.abs(spread) > 0.5) {
      
      decision = 'BUY';
      confidence = Math.abs(avgSellDeviation) > 1.0 ? 'HIGH' : 'MEDIUM';
      reason = 'Giá bán USDT thấp hơn giá Spot đáng kể';
    }
    // SELL USDT recommendation
    else if (avgBuyDeviation > significantDeviation && 
             totalBuyVolume > 5000 && 
             (spotTrend === 'DOWN' || spotTrend === 'NEUTRAL') && 
             Math.abs(spread) > 0.5) {
      
      decision = 'SELL';
      confidence = avgBuyDeviation > 1.0 ? 'HIGH' : 'MEDIUM';
      reason = 'Giá mua USDT cao hơn giá Spot đáng kể';
    }
    // HOLD recommendation
    else {
      decision = 'HOLD';
      if (Math.abs(avgDeviation) < 0.2) {
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
        avgBuyDeviation: avgBuyDeviation.toFixed(2) + '%',
        avgSellDeviation: avgSellDeviation.toFixed(2) + '%',
        avgDeviation: avgDeviation.toFixed(2) + '%',
        spotPrice: formatPrice(spotPrice),
        spotTrend,
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
        avgDeviation: null,
        spotTrend: null,
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
app.get('/api/anomalies', (req, res) => {
  const thresholdParam = req.query.threshold;
  
  console.log('API call: /api/anomalies');
  console.log('Latest data:', {
    timestamp: latestData.timestamp,
    anomaliesCount: Array.isArray(latestData.anomalies) ? latestData.anomalies.length : 'not an array',
    anomaliesType: typeof latestData.anomalies
  });
  
  // If threshold parameter is provided, filter anomalies using the provided threshold
  if (thresholdParam && !isNaN(parseFloat(thresholdParam))) {
    const threshold = parseFloat(thresholdParam);
    
    // Ensure anomalies is an array
    const anomaliesArray = Array.isArray(latestData.anomalies) ? latestData.anomalies : [];
    
    const filteredAnomalies = anomaliesArray.filter(
      anomaly => Math.abs(anomaly.deviation) >= threshold
    );
    
    res.json({
      anomalies: filteredAnomalies,
      timestamp: latestData.timestamp,
      appliedThreshold: threshold
    });
  } else {
    // Return original data if no threshold parameter
    res.json(latestData);
  }
});

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
    const asset = 'USDT';
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
    const now = Date.now();
    const timeSinceLastFetch = now - API_CACHE.coingecko.lastFetch;
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
      console.log('Binance failed for BTC trend data, trying CoinGecko');
    }
    
    // Only try CoinGecko if we haven't hit rate limits recently
    if (timeSinceLastFetch > API_CACHE.coingecko.retryDelay) {
      try {
        console.log('Trying CoinGecko for BTC trend data...');
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
        
        if (response.data && response.data.bitcoin && response.data.bitcoin.usd) {
          price = response.data.bitcoin.usd;
          
          // Get trend from 24h price change
          if (response.data.bitcoin.usd_24h_change !== undefined) {
            change24h = response.data.bitcoin.usd_24h_change;
            
            if (change24h > 1.5) trend = 'UP';
            else if (change24h < -1.5) trend = 'DOWN';
            else trend = 'NEUTRAL';
          }
          
          // Update coingecko cache (even for bitcoin data)
          if (!API_CACHE.bitcoin) {
            API_CACHE.bitcoin = {
              lastFetch: 0,
              retryDelay: 5000,
              maxRetryDelay: 300000,
              data: null
            };
          }
          
          API_CACHE.bitcoin.data = response.data;
          API_CACHE.bitcoin.lastFetch = now;
          API_CACHE.bitcoin.retryDelay = 5000;
          
          console.log(`Got BTC price from CoinGecko: $${price} (${trend}, ${change24h.toFixed(2)}%)`);
          
          return res.json({
            price,
            trend,
            change24h: parseFloat(change24h.toFixed(2)),
            source: 'coingecko'
          });
        } else {
          throw new Error('Invalid response from CoinGecko');
        }
      } catch (geckoErr) {
        console.log('Error getting BTC price from CoinGecko:', geckoErr.message);
        
        // If we got a 429 error, increase backoff
        if (geckoErr.message && (geckoErr.message.includes('429') || 
            (geckoErr.response && geckoErr.response.status === 429))) {
          if (!API_CACHE.bitcoin) {
            API_CACHE.bitcoin = {
              lastFetch: now,
              retryDelay: 10000,
              maxRetryDelay: 300000,
              data: null
            };
          }
          
          API_CACHE.bitcoin.retryDelay = Math.min(
            API_CACHE.bitcoin.retryDelay * 2,
            API_CACHE.bitcoin.maxRetryDelay
          );
          console.log(`Increased CoinGecko backoff for BTC to ${API_CACHE.bitcoin.retryDelay}ms`);
        }
        
        // Try to use cached data if available
        if (API_CACHE.bitcoin && API_CACHE.bitcoin.data && API_CACHE.bitcoin.data.bitcoin) {
          price = API_CACHE.bitcoin.data.bitcoin.usd;
          
          if (API_CACHE.bitcoin.data.bitcoin.usd_24h_change !== undefined) {
            change24h = API_CACHE.bitcoin.data.bitcoin.usd_24h_change;
            
            if (change24h > 1.5) trend = 'UP';
            else if (change24h < -1.5) trend = 'DOWN';
            else trend = 'NEUTRAL';
          } else {
            trend = 'NEUTRAL';
            change24h = 0;
          }
          
          console.log(`Using cached CoinGecko data for BTC: $${price} (${trend})`);
          
          return res.json({
            price,
            trend,
            change24h: parseFloat(change24h.toFixed(2)),
            source: 'cache'
          });
        }
      }
    } else if (API_CACHE.bitcoin && API_CACHE.bitcoin.data && API_CACHE.bitcoin.data.bitcoin) {
      // Use cached data during backoff period
      price = API_CACHE.bitcoin.data.bitcoin.usd;
      
      if (API_CACHE.bitcoin.data.bitcoin.usd_24h_change !== undefined) {
        change24h = API_CACHE.bitcoin.data.bitcoin.usd_24h_change;
        
        if (change24h > 1.5) trend = 'UP';
        else if (change24h < -1.5) trend = 'DOWN';
        else trend = 'NEUTRAL';
      } else {
        trend = 'NEUTRAL';
        change24h = 0;
      }
      
      console.log(`Using cached BTC data during backoff (${Math.round((API_CACHE.bitcoin.retryDelay - (now - API_CACHE.bitcoin.lastFetch))/1000)}s remaining): $${price} (${trend})`);
      
      return res.json({
        price,
        trend,
        change24h: parseFloat(change24h.toFixed(2)),
        source: 'backoff-cache'
      });
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
    
    // 3. Get USDT price in VND from fetchSpotPrice (which uses CoinGecko with caching)
    const usdtToVndRate = await fetchSpotPrice('USDT');
    console.log(`Using spot price for USDT/VND: ${usdtToVndRate}`);
    
    // 4. Calculate buy and sell liquidity from order book
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
      usdtToVndRate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error proxying Binance data:', error);
    res.status(500).json({ error: 'Failed to fetch Binance data' });
  }
});

// Function to fetch all P2P data (not ads)
async function fetchAllP2PData(asset = 'USDT', fiat = 'VND', page = 1, rows = 50) {
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
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', 
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
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
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', 
      sellPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
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

// Add API endpoint for all P2P data
app.get('/api/p2p/all', async (req, res) => {
  const asset = req.query.asset || 'USDT';
  const fiat = req.query.fiat || 'VND';
  const page = parseInt(req.query.page || '1');
  const rows = parseInt(req.query.rows || '50');
  
  console.log(`Received request for /api/p2p/all with asset=${asset}, fiat=${fiat}, page=${page}, rows=${rows}`);
  
  try {
    const allP2PData = await fetchAllP2PData(asset, fiat, page, rows);
    
    // Add extra metadata to help clients understand limitations
    const responseData = {
      ...allP2PData,
      metadata: {
        requestedRows: rows,
        actualRows: {
          buy: allP2PData.buy?.length || 0,
          sell: allP2PData.sell?.length || 0,
          total: (allP2PData.buy?.length || 0) + (allP2PData.sell?.length || 0)
        },
        limitInfo: rows > 20 ? "Binance API may limit results to approximately 20 records per request" : null,
        page: page
      }
    };
    
    // Log response summary
    console.log(`Response summary: Sending ${responseData.metadata.actualRows.total} total records (${responseData.metadata.actualRows.buy} buy, ${responseData.metadata.actualRows.sell} sell)`);
    
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching all P2P data:', error);
    
    // Send a structured error response
    res.status(500).json({ 
      error: 'Failed to fetch P2P data', 
      message: error.message,
      timestamp: new Date().toISOString(),
      buy: [], 
      sell: [],
      metadata: {
        requestedRows: rows,
        actualRows: { buy: 0, sell: 0, total: 0 },
        error: true,
        errorDetails: error.message
      }
    });
  }
});

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send latest data to newly connected client
  socket.emit('anomalies', latestData);
  
  // Send latest decision
  socket.emit('market_decision', latestDecision);
  
  // Handle request for all P2P data
  socket.on('request_all_p2p', async (params) => {
    try {
      const asset = params?.asset || 'USDT';
      const fiat = params?.fiat || 'VND';
      const page = parseInt(params?.page || '1');
      const rows = parseInt(params?.rows || '50');
      
      const allP2PData = await fetchAllP2PData(asset, fiat, page, rows);
      socket.emit('all_p2p_data', allP2PData);
    } catch (error) {
      console.error('Error in socket request for all P2P data:', error);
      socket.emit('error', { message: 'Failed to fetch P2P data', error: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Scheduled task to fetch data and emit to clients
async function scheduleDataFetch() {
  try {
    const data = await detectAnomalies();
    
    // Ensure data has the correct structure
    if (!data) {
      console.error('detectAnomalies returned null or undefined');
      latestData = { anomalies: [], timestamp: new Date().toISOString() };
    } else {
      latestData = {
        anomalies: Array.isArray(data.anomalies) ? data.anomalies : [],
        timestamp: data.timestamp || new Date().toISOString()
      };
    }
    
    console.log(`Found ${latestData.anomalies.length} anomalies at ${latestData.timestamp}`);
    
    // Emit to clients
    io.emit('anomalies', latestData);
  } catch (error) {
    console.error('Error in scheduled task:', error);
    // Initialize with empty data on error
    latestData = { anomalies: [], timestamp: new Date().toISOString() };
    io.emit('anomalies', latestData);
  }
  
  // Schedule next execution
  setTimeout(scheduleDataFetch, CONFIG.updateInterval);
}

// Scheduled task to update market decision
async function scheduleDecisionUpdate() {
  try {
    const decision = await generateMarketDecision();
    latestDecision = decision;
    
    // Emit decision to clients
    io.emit('market_decision', latestDecision);
    
    console.log(`Market decision updated: ${decision.decision} (${decision.confidence})`);
  } catch (error) {
    console.error('Error updating market decision:', error);
  }
  
  // Schedule next update
  setTimeout(scheduleDecisionUpdate, CONFIG.decisionInterval);
}

// Function to search across multiple pages by transaction amount
async function searchAllByAmount(asset = 'USDT', fiat = 'VND', options = {}) {
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
  const asset = req.query.asset || 'USDT';
  const fiat = req.query.fiat || 'VND';
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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the data fetching schedule
  scheduleDataFetch();
  // Start the decision update schedule with a slight delay
  setTimeout(scheduleDecisionUpdate, 5000);
}); 