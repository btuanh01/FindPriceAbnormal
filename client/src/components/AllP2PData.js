import React, { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Button, Table, Spinner, Form, Row, Col } from 'react-bootstrap';

// Add custom styles for the filter components
const filterStyles = `
  .filter-controls-container {
    margin-top: 15px;
  }
  
  .filter-card {
    border: none;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border-radius: 16px;
    transition: all 0.3s ease;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .filter-card:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }
  
  .filter-section-title {
    font-weight: 700;
    color: #2d3748;
    font-size: 1.3rem;
    display: flex;
    align-items: center;
    padding-bottom: 15px;
    margin-bottom: 20px;
    border-bottom: 2px solid rgba(58, 123, 213, 0.1);
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .filter-section-divider {
    height: 2px;
    background: linear-gradient(90deg, #3a7bd5, #6c63ff, #3a7bd5);
    border: none;
    border-radius: 2px;
    margin: 25px 0;
    opacity: 0.3;
  }
  
  .filter-group {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.06);
    transition: all 0.3s ease;
  }
  
  .filter-group:hover {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
  
  .filter-group-title {
    font-weight: 600;
    color: #4a5568;
    font-size: 1rem;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
  }
  
  .filter-group-title i {
    margin-right: 8px;
    width: 20px;
    text-align: center;
  }
  
  .compact-filter-row {
    padding: 8px 0;
  }
  
  .compact-filter-row .form-label {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 5px;
  }
  
  .compact-filter-row .form-group {
    margin-bottom: 10px;
  }
  
  .compact-filter-row .filter-input-group {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  
  .compact-filter-row .filter-input-group:focus-within {
    box-shadow: 0 4px 15px rgba(58, 123, 213, 0.15);
  }
  
  .filter-select {
    border-radius: 10px;
    font-weight: 500;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    border: 2px solid #e2e8f0;
    padding: 12px 16px;
    background: #ffffff;
  }
  
  .filter-select:focus {
    box-shadow: 0 4px 15px rgba(58, 123, 213, 0.15);
    border-color: #3a7bd5;
    background: #fafbfc;
    transform: translateY(-1px);
  }
  
  .filter-select:hover {
    border-color: #cbd5e0;
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
  }
  
  .input-group.filter-input-group {
    box-shadow: 0 3px 15px rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s ease;
    width: 100%;
    border: 2px solid transparent;
  }
  
  .filter-input-group:focus-within {
    box-shadow: 0 6px 25px rgba(58, 123, 213, 0.2);
    transform: translateY(-2px);
    border-color: rgba(58, 123, 213, 0.3);
  }
  
  .filter-input-group:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  
  .filter-currency-symbol {
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    color: white;
    border: none;
    font-weight: bold;
    width: 50px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1rem;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .filter-amount-input {
    border-left: none;
    border-right: none;
    font-weight: 500;
    font-size: 1.05rem;
    padding: 12px 16px;
    background-color: #fff;
    border-top: none;
    border-bottom: none;
  }
  
  .filter-amount-input:focus {
    box-shadow: none;
    border-color: transparent;
    background-color: #fafbfc;
  }
  
  .filter-amount-input::placeholder {
    color: #a0aec0;
    font-weight: 400;
  }
  
  .filter-clear-btn {
    margin-left: 0;
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    background-color: #fff;
    color: #6c757d;
    transition: all 0.3s ease;
    padding: 12px 16px;
    border-color: #e2e8f0;
  }
  
  .filter-clear-btn:hover {
    background: linear-gradient(135deg, #fed7d7, #feb2b2);
    color: #e53e3e;
    border-color: #fc8181;
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(229, 62, 62, 0.2);
  }
  
  .filter-search-btn {
    margin-left: 0;
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    border: none;
    color: white;
    transition: all 0.3s ease;
    padding: 12px 16px;
    font-weight: 600;
    position: relative;
    overflow: hidden;
  }
  
  .filter-search-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }
  
  .filter-search-btn:hover:not(:disabled)::before {
    left: 100%;
  }
  
  .filter-search-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #3373c4, #5a52e0);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(58, 123, 213, 0.3);
  }
  
  .filter-search-btn:disabled {
    background: linear-gradient(135deg, #e9ecef, #dee2e6);
    color: #6c757d;
    border: none;
    cursor: not-allowed;
  }
  
  .filter-help-text {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #6c757d;
    display: flex;
    align-items: center;
  }
  
  .active-filter-indicator {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .active-filter-indicator .badge {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    border: none;
    box-shadow: 0 4px 12px rgba(58, 123, 213, 0.2);
    transition: all 0.3s ease;
  }
  
  .active-filter-indicator .badge:hover {
    box-shadow: 0 6px 15px rgba(58, 123, 213, 0.3);
  }
  
  .filter-badge .bi-x-circle-fill {
    opacity: 0.7;
    transition: all 0.2s ease;
  }
  
  .filter-badge .bi-x-circle-fill:hover {
    opacity: 1;
    transform: scale(1.1);
  }
  
  .order-type-btn {
    font-weight: 500;
    padding: 0.5rem 0;
  }
  
  .order-type-btn.btn-primary {
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    border: none;
    box-shadow: 0 4px 10px rgba(58, 123, 213, 0.2);
  }
  
  .refresh-btn {
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    border: none;
    box-shadow: 0 4px 10px rgba(58, 123, 213, 0.2);
    font-weight: 500;
    padding: 0.5rem 1.25rem;
    transition: all 0.3s ease;
  }
  
  .refresh-btn:hover:not(:disabled) {
    box-shadow: 0 6px 15px rgba(58, 123, 213, 0.3);
    transform: translateY(-1px);
  }
  
  .auto-refresh-indicator {
    display: flex;
    justify-content: center;
    margin-top: 10px;
  }
  
  .auto-refresh-badge {
    border-radius: 20px;
    padding: 8px 15px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    margin-top: 5px;
  }
  
  .price-cell-highlighted {
    background-color: #ffebee !important;
    color: #c62828 !important;
    font-weight: bold !important;
    border-left: 3px solid #f44336 !important;
    animation: highlightPulse 2s ease-in-out infinite alternate;
  }
  
  @keyframes highlightPulse {
    from {
      background-color: #ffebee;
    }
    to {
      background-color: #ffcdd2;
    }
  }
  
  .price-warning-icon {
    animation: shake 0.8s ease-in-out infinite;
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
  }
  
  .discord-toggle .form-check-input {
    width: 3rem;
    height: 1.5rem;
    background-color: #dc3545;
    border-color: #dc3545;
    transition: all 0.3s ease;
  }
  
  .discord-toggle .form-check-input:checked {
    background-color: #198754;
    border-color: #198754;
  }
  
  .discord-toggle .form-check-input:focus {
    box-shadow: 0 0 0 0.25rem rgba(25, 135, 84, 0.25);
  }
  
  .auto-refresh-badge i {
    color: #3a7bd5;
    font-size: 1rem;
  }
  
  .search-all-btn {
    font-weight: 500;
    border-radius: var(--border-radius);
    transition: all 0.2s ease;
    font-size: 0.9rem;
  }
  
  .search-all-btn:hover:not(:disabled) {
    background-color: #eaeffd;
    border-color: #3a7bd5;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
  }
  
  .search-all-btn:disabled {
    opacity: 0.65;
  }
  
  /* Merchant name link styling */
  .merchant-name-link {
    color: #3a7bd5;
    font-weight: 600;
    transition: all 0.2s ease;
    cursor: pointer;
    text-decoration: none !important;
  }
  
  .merchant-name-link:hover {
    color: #2c5aa0;
    text-decoration: underline !important;
    transform: scale(1.02);
  }
  
  .merchant-name-link:hover .merchant-name {
    text-shadow: 0 1px 3px rgba(58, 123, 213, 0.3);
  }
  
  .merchant-name {
    transition: all 0.2s ease;
  }
`;

const AllP2PData = () => {
  // Local implementation of formatVND in case the import fails
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  };

  // LocalStorage keys
  const STORAGE_KEYS = {
    SPREAD_BUY: 'p2p_spread_buy',
    FORMATTED_SPREAD_BUY: 'p2p_formatted_spread_buy',
    APPLIED_SPREAD_BUY: 'p2p_applied_spread_buy',
    APPLIED_FORMATTED_SPREAD_BUY: 'p2p_applied_formatted_spread_buy',
    MIN_LIMIT: 'p2p_min_limit',
    FORMATTED_MIN_LIMIT: 'p2p_formatted_min_limit',
    APPLIED_MIN_LIMIT: 'p2p_applied_min_limit',
    APPLIED_FORMATTED_MIN_LIMIT: 'p2p_applied_formatted_min_limit',
    DISCORD_ENABLED: 'p2p_discord_enabled',
    PREVIOUS_TOP1_MERCHANT: 'p2p_previous_top1_merchant',
    CURRENT_TOP1_MERCHANT: 'p2p_current_top1_merchant'
  };

  // Function to save filter state to localStorage
  const saveFilterState = (key, value) => {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn('Failed to save filter state:', error);
    }
  };

  // Function to load filter state from localStorage
  const loadFilterState = (key, defaultValue = null) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.warn('Failed to load filter state:', error);
      return defaultValue;
    }
  };

  // Initialize states with localStorage values
  const [allP2PData, setAllP2PData] = useState({ buy: [], sell: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextRefresh, setNextRefresh] = useState(15);
  
  // Filter states with localStorage initialization
  const [spreadBuy, setSpreadBuy] = useState(() => loadFilterState(STORAGE_KEYS.SPREAD_BUY, '100'));
  const [formattedSpreadBuy, setFormattedSpreadBuy] = useState(() => loadFilterState(STORAGE_KEYS.FORMATTED_SPREAD_BUY, '100'));
  const [appliedSpreadBuy, setAppliedSpreadBuy] = useState(() => loadFilterState(STORAGE_KEYS.APPLIED_SPREAD_BUY, '100'));
  const [appliedFormattedSpreadBuy, setAppliedFormattedSpreadBuy] = useState(() => loadFilterState(STORAGE_KEYS.APPLIED_FORMATTED_SPREAD_BUY, '100'));
  
  // Min limit filter state with localStorage initialization
  const [minLimit, setMinLimit] = useState(() => loadFilterState(STORAGE_KEYS.MIN_LIMIT, ''));
  const [formattedMinLimit, setFormattedMinLimit] = useState(() => loadFilterState(STORAGE_KEYS.FORMATTED_MIN_LIMIT, ''));
  const [appliedMinLimit, setAppliedMinLimit] = useState(() => loadFilterState(STORAGE_KEYS.APPLIED_MIN_LIMIT, ''));
  const [appliedFormattedMinLimit, setAppliedFormattedMinLimit] = useState(() => loadFilterState(STORAGE_KEYS.APPLIED_FORMATTED_MIN_LIMIT, ''));
  
  // Previous top 1 merchant from table for automatic comparison with localStorage
  const [previousTop1Merchant, setPreviousTop1Merchant] = useState(() => loadFilterState(STORAGE_KEYS.PREVIOUS_TOP1_MERCHANT, null));
  const [currentTop1Merchant, setCurrentTop1Merchant] = useState(() => loadFilterState(STORAGE_KEYS.CURRENT_TOP1_MERCHANT, null));
  
  // Discord webhook states with localStorage initialization
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  const [notifiedPrices, setNotifiedPrices] = useState(new Set());
  const [discordEnabled, setDiscordEnabled] = useState(() => loadFilterState(STORAGE_KEYS.DISCORD_ENABLED, false));
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  // Fixed values for asset and fiat
  const asset = 'USDT';
  const fiat = 'VND';

  // Enhanced state setters that also save to localStorage
  const setSpreadBuyWithStorage = (value) => {
    setSpreadBuy(value);
    saveFilterState(STORAGE_KEYS.SPREAD_BUY, value);
  };

  const setFormattedSpreadBuyWithStorage = (value) => {
    setFormattedSpreadBuy(value);
    saveFilterState(STORAGE_KEYS.FORMATTED_SPREAD_BUY, value);
  };

  const setAppliedSpreadBuyWithStorage = (value) => {
    setAppliedSpreadBuy(value);
    saveFilterState(STORAGE_KEYS.APPLIED_SPREAD_BUY, value);
  };

  const setAppliedFormattedSpreadBuyWithStorage = (value) => {
    setAppliedFormattedSpreadBuy(value);
    saveFilterState(STORAGE_KEYS.APPLIED_FORMATTED_SPREAD_BUY, value);
  };

  const setMinLimitWithStorage = (value) => {
    setMinLimit(value);
    saveFilterState(STORAGE_KEYS.MIN_LIMIT, value);
  };

  const setFormattedMinLimitWithStorage = (value) => {
    setFormattedMinLimit(value);
    saveFilterState(STORAGE_KEYS.FORMATTED_MIN_LIMIT, value);
  };

  const setAppliedMinLimitWithStorage = (value) => {
    setAppliedMinLimit(value);
    saveFilterState(STORAGE_KEYS.APPLIED_MIN_LIMIT, value);
  };

  const setAppliedFormattedMinLimitWithStorage = (value) => {
    setAppliedFormattedMinLimit(value);
    saveFilterState(STORAGE_KEYS.APPLIED_FORMATTED_MIN_LIMIT, value);
  };

  const setPreviousTop1MerchantWithStorage = (value) => {
    setPreviousTop1Merchant(value);
    saveFilterState(STORAGE_KEYS.PREVIOUS_TOP1_MERCHANT, value);
  };

  const setCurrentTop1MerchantWithStorage = (value) => {
    setCurrentTop1Merchant(value);
    saveFilterState(STORAGE_KEYS.CURRENT_TOP1_MERCHANT, value);
  };

  const setDiscordEnabledWithStorage = (value) => {
    setDiscordEnabled(value);
    saveFilterState(STORAGE_KEYS.DISCORD_ENABLED, value);
  };

  // Define fetchAllP2PData before using it in useEffect
  const fetchAllP2PData = useCallback(async (skipLoading = false) => {
    try {
      if (!skipLoading) setLoading(true);
      setError(null);
      
      const startTime = Date.now();
      
      // Use relative path with proxy configured in package.json
      const apiUrl = `/api/p2p/all?asset=${asset}&fiat=${fiat}&minLimit=${appliedMinLimit}`;
      console.log(`Đang tải dữ liệu top 20 P2P từ API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server responded with status: ${response.status} - ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Unexpected response type:', contentType);
        console.error('Response body:', text);
        throw new Error(`Expected JSON but got ${contentType || 'unknown type'}`);
      }
      
      const data = await response.json();
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      console.log(`Đã nhận dữ liệu top 20 P2P trong ${executionTime}ms:`, data);
      
      // Check for errors from server
      if (data.error) {
        console.error('Error from server:', data.error);
        if (data.metadata?.errorType) {
          console.error('Error type:', data.metadata.errorType);
          console.error('Original error:', data.metadata.originalError);
        }
        
        // Provide specific error messages based on error type
        let errorMessage = data.error;
        if (data.metadata?.errorType === 'timeout') {
          errorMessage = 'Binance API is not responding. This might be due to network issues or the API being temporarily unavailable.';
        } else if (data.metadata?.errorType === 'network') {
          errorMessage = 'Cannot connect to Binance API. Please check your internet connection.';
        } else if (data.metadata?.errorType === 'rate_limit') {
          errorMessage = 'Too many requests to Binance API. Please wait a moment and try again.';
        } else if (data.metadata?.errorType === 'forbidden') {
          errorMessage = 'Access to Binance API is restricted. This might be due to geographic restrictions.';
        } else if (data.metadata?.errorType === 'server_error') {
          errorMessage = 'Binance API is experiencing server issues. Please try again later.';
        } else if (data.metadata?.errorType === 'binance_api_error') {
          errorMessage = `Binance API Error: ${data.metadata.binanceError?.message || 'Unknown error'}`;
          if (data.metadata.binanceError?.code === '000002') {
            errorMessage = 'Invalid request parameters. The API request format may have changed.';
          }
        }
        
        setError(errorMessage);
        setAllP2PData({ buy: [], sell: [], timestamp: new Date().toISOString() });
        return;
      }
      
      // Check if we have data
      if (!data.buy || data.buy.length === 0) {
        setError('No P2P data available for this asset and currency pair. Try with a different asset or check if the market is active.');
        setAllP2PData({ buy: [], sell: [], timestamp: new Date().toISOString() });
        return;
      }
      
      setAllP2PData(data);
      setLastRefreshTime(`${executionTime}ms`);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu top 20 P2P:', err);
      setError(err.message);
    } finally {
      if (!skipLoading) setLoading(false);
    }
  }, [asset, fiat, appliedMinLimit]);

  // Function to format input as VND
  const formatInputAsVND = (value) => {
    // Remove non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    
    if (!numericValue) return '';
    
    // Format as VND without the currency symbol
    return new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: 0
    }).format(numericValue);
  };
  
  // Removed filter-related functions - no longer needed

  // Function to handle spread buy change
  const handleSpreadBuyChange = (e) => {
    const inputValue = e.target.value;
    
    // Remove all non-numeric characters for the actual value
    const numericValue = inputValue.replace(/[^0-9]/g, '');
    
    // Update the state variables
    setSpreadBuyWithStorage(numericValue);
    setFormattedSpreadBuyWithStorage(formatInputAsVND(numericValue));
  };

  // Function to apply the spread buy filter
  const applySpreadBuyFilter = () => {
    setAppliedSpreadBuyWithStorage(spreadBuy);
    setAppliedFormattedSpreadBuyWithStorage(formattedSpreadBuy);
  };

  // Function to handle min limit change
  const handleMinLimitChange = (e) => {
    const inputValue = e.target.value;
    const numericValue = inputValue.replace(/[^0-9]/g, '');
    setMinLimitWithStorage(numericValue);
    setFormattedMinLimitWithStorage(formatInputAsVND(numericValue));
  };

  // Function to apply the min limit filter
  const applyMinLimitFilter = () => {
    setAppliedMinLimitWithStorage(minLimit);
    setAppliedFormattedMinLimitWithStorage(formattedMinLimit);
  };

  // Update top 1 merchant from data when data changes (after each refresh)
  useEffect(() => {
    const dataToCheck = allP2PData.buy;
    
    if (dataToCheck && dataToCheck.length > 0) {
      // Filter for merchants only from the actual data being used
      const merchantsOnly = dataToCheck.filter(item => item.advertiser.userType === 'merchant');
      
      if (merchantsOnly.length > 0) {
        const newTop1Merchant = {
          name: merchantsOnly[0].advertiser.nickName,
          price: parseFloat(merchantsOnly[0].adv.price),
          userNo: merchantsOnly[0].advertiser.userNo
        };
        
        console.log('New top 1 merchant found:', newTop1Merchant);
        
        // Always store current as previous on refresh, then update current
        if (currentTop1Merchant !== null) {
          setPreviousTop1MerchantWithStorage(currentTop1Merchant);
          console.log('Previous top 1 merchant set to:', currentTop1Merchant);
        }
        
        setCurrentTop1MerchantWithStorage(newTop1Merchant);
      }
    }
  }, [allP2PData.buy, allP2PData.timestamp]);

  // Function to clear stored merchants and reset
  const clearStoredMerchants = () => {
    setPreviousTop1MerchantWithStorage(null);
    setCurrentTop1MerchantWithStorage(null);
    setSpreadBuyWithStorage('100');
    setFormattedSpreadBuyWithStorage('100');
    setMinLimitWithStorage('');
    setFormattedMinLimitWithStorage('');
    setAppliedSpreadBuyWithStorage('100');
    setAppliedFormattedSpreadBuyWithStorage('100');
    setAppliedMinLimitWithStorage('');
    setAppliedFormattedMinLimitWithStorage('');
    setNotifiedPrices(new Set()); // Clear notification history
    setDiscordEnabledWithStorage(false); // Disable Discord when clearing
    console.log('Stored merchants and filters cleared');
  };

  // Diagnostic function to compare table vs Discord highlighting
  const compareTableVsDiscordHighlighting = () => {
    console.log('\n🔍 === TABLE vs DISCORD HIGHLIGHTING COMPARISON ===');
    
    // Get the data that the table is using
    const tableData = getFilteredData();
    console.log('📊 Table data source:', tableData?.length || 0, 'items');
    
    // Get the data that Discord notification is using
    const discordData = allP2PData.buy;
    console.log('📢 Discord data source:', discordData?.length || 0, 'items');
    
    console.log('\n=== TABLE HIGHLIGHTING (ALL listings - merchants AND users) ===');
    if (tableData && tableData.length > 0) {
      const highlightedInTable = [];
      tableData.forEach((item, index) => {
        const p2pPrice = parseFloat(item.adv.price);
        const isHighlighted = shouldHighlightPrice(p2pPrice, 'BUY');
        const isMerchant = item.advertiser.userType === 'merchant';
        
        console.log(`${index + 1}. ${item.advertiser.nickName} (${isMerchant ? 'MERCHANT' : 'USER'}): ${formatVND(p2pPrice)} ${isHighlighted ? '🔥 HIGHLIGHTED' : '✅ Normal'}`);
        
        if (isHighlighted) {
          highlightedInTable.push({ ...item, isMerchant });
        }
      });
      
      const highlightedMerchantsInTable = highlightedInTable.filter(item => item.isMerchant);
      const highlightedUsersInTable = highlightedInTable.filter(item => !item.isMerchant);
      
      console.log(`📋 Table summary: ${highlightedInTable.length} total highlighted (${highlightedMerchantsInTable.length} merchants, ${highlightedUsersInTable.length} users)`);
    } else {
      console.log('❌ No table data');
    }
    
    console.log('\n=== DISCORD NOTIFICATION LOGIC (ALL LISTINGS) ===');
    console.log('Discord enabled:', discordEnabled);
    console.log('Previous top 1 merchant:', previousTop1Merchant);
    console.log('Loading:', loading);
    
    if (!discordEnabled) {
      console.log('❌ Discord is disabled - no notifications will be sent');
      return;
    }
    
    if (!previousTop1Merchant) {
      console.log('❌ No previous top 1 merchant - need 2 refreshes first');
      return;
    }
    
    if (loading) {
      console.log('❌ Still loading - notifications skipped');
      return;
    }
    
    console.log('✅ Discord prerequisites met, checking all listings...');
    
    if (discordData && discordData.length > 0) {
      // Check ALL listings for highlighting
      const allHighlighted = discordData.filter(item => shouldHighlightPrice(parseFloat(item.adv.price), 'BUY'));
      const highlightedMerchants = allHighlighted.filter(item => item.advertiser.userType === 'merchant');
      const highlightedUsers = allHighlighted.filter(item => item.advertiser.userType !== 'merchant');
      
      console.log(`🔥 All highlighted listings: ${allHighlighted.length} total`);
      console.log(`🏪 Highlighted merchants: ${highlightedMerchants.length} (will notify)`);
      console.log(`👤 Highlighted users: ${highlightedUsers.length} (will notify)`);
      
      if (allHighlighted.length > 0) {
        console.log('\nAll highlighted listings (Discord candidates):');
        const newListingsForDiscord = [];
        allHighlighted.forEach((item, index) => {
          const p2pPrice = parseFloat(item.adv.price);
          const itemKey = `BUY-${item.advertiser.userNo}-${p2pPrice}`;
          const alreadyNotified = notifiedPrices.has(itemKey);
          const isMerchant = item.advertiser.userType === 'merchant';
          
          console.log(`${index + 1}. ${item.advertiser.nickName} (${isMerchant ? 'MERCHANT' : 'USER'}): ${formatVND(p2pPrice)} ${alreadyNotified ? '(Already notified)' : '(NEW)'}`);
          
          if (!alreadyNotified) {
            newListingsForDiscord.push(item);
          }
        });
        
        console.log(`📋 NEW listings ready for Discord: ${newListingsForDiscord.length}`);
        
        // Check throttling
        const currentTime = Date.now();
        const timeSinceLastNotification = currentTime - lastNotificationTime;
        console.log(`⏰ Time since last notification: ${Math.round(timeSinceLastNotification / 1000)}s (need 25s)`);
        
        if (newListingsForDiscord.length > 0) {
          if (timeSinceLastNotification > 25000) {
            console.log('🚀 Discord notification SHOULD be sent now!');
          } else {
            console.log(`⏳ Discord notification THROTTLED - wait ${Math.round((25000 - timeSinceLastNotification) / 1000)}s more`);
          }
        }
      }
      
      if (allHighlighted.length === 0) {
        console.log('ℹ️ No highlighted listings found');
      }
    } else {
      console.log('❌ No Discord data available');
    }
    
    console.log('=== END COMPARISON ===\n');
  };

  // Debug function to check highlighting logic
  const debugHighlightingLogic = () => {
    console.log('\n=== DEBUGGING HIGHLIGHTING LOGIC ===');
    console.log('Discord enabled:', discordEnabled);
    console.log('Previous top 1 merchant:', previousTop1Merchant);
    console.log('Current top 1 merchant:', currentTop1Merchant);
    console.log('Spread buy:', spreadBuy, 'Formatted:', formattedSpreadBuy);
    console.log('Loading:', loading);
    console.log('All P2P data buy:', allP2PData.buy?.length, 'items');
    
    if (previousTop1Merchant && spreadBuy) {
      const spread = parseFloat(spreadBuy);
      const threshold = previousTop1Merchant.price - spread;
      console.log(`Threshold: ${threshold} (${previousTop1Merchant.price} - ${spread})`);
      
      if (allP2PData.buy && allP2PData.buy.length > 0) {
        console.log('\nChecking merchants:');
        allP2PData.buy.forEach((item, index) => {
          if (item.advertiser.userType === 'merchant') {
            const p2pPrice = parseFloat(item.adv.price);
            const isHighlighted = p2pPrice < threshold;
            console.log(`${index + 1}. ${item.advertiser.nickName}: ${formatVND(p2pPrice)} ${isHighlighted ? '🔥 HIGHLIGHTED' : '❌ Not highlighted'}`);
          }
        });
      }
    } else {
      console.log('Cannot check highlighting: missing previous top 1 merchant or spread');
    }
    
    console.log('\nLast notification time:', lastNotificationTime);
    console.log('Current time:', Date.now());
    console.log('Time since last notification:', Date.now() - lastNotificationTime, 'ms');
    console.log('Notified prices set size:', notifiedPrices.size);
    console.log('=== END DEBUG ===\n');
    
    // Run the comparison
    compareTableVsDiscordHighlighting();
  };

  // Test Discord webhook function
  const testDiscordWebhook = async () => {
    const webhookUrl = 'https://discord.com/api/webhooks/1390228615265910866/s7yqgMI9gceXNc9urmIaWl6IkbqLO2D5JhNaV7BfyoEX9xtARdpiEhGvFhFQVwO2GYlI';
    
    try {
      console.log('Testing Discord webhook...');
      
      const embed = {
        title: '🧪 Test Discord Webhook',
        description: 'This is a test message from the P2P Dashboard',
        color: 0x00ff00, // Green color
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Test Message'
        },
        fields: [
          {
            name: '📊 Test Status',
            value: `Discord webhook is working correctly!\nTime: ${new Date().toLocaleTimeString()}`,
            inline: false
          }
        ]
      };
      
      const payload = {
        username: 'P2P Test Bot',
        embeds: [embed]
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log('Discord test webhook sent successfully');
        alert('Discord test message sent successfully! Check your Discord channel.');
      } else {
        const errorText = await response.text();
        console.error('Discord test webhook failed with status:', response.status, errorText);
        alert(`Discord test failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error sending Discord test webhook:', error);
      alert(`Discord test error: ${error.message}`);
    }
  };

  // Discord webhook function
  const sendDiscordWebhook = async (highlightedItems) => {
    try {
      const webhookUrl = 'https://discord.com/api/webhooks/1390228615265910866/s7yqgMI9gceXNc9urmIaWl6IkbqLO2D5JhNaV7BfyoEX9xtARdpiEhGvFhFQVwO2GYlI';
      
      const merchants = highlightedItems.filter(item => item.isMerchant);
      const users = highlightedItems.filter(item => !item.isMerchant);
      
      let message = `🚨 CẢNH BÁO GIÁ 🚨\n\n`;
      
      if (previousTop1Merchant) {
        message += `Tham chiếu: ${previousTop1Merchant.name} - ${formatVND(previousTop1Merchant.price)}\n`;
        message += `Ngưỡng cảnh báo: ${formatVND(previousTop1Merchant.price - parseFloat(appliedSpreadBuy))} (chênh lệch: ${appliedFormattedSpreadBuy})\n\n`;
      }
      
      if (merchants.length > 0) {
        message += `🏪 MERCHANTS (${merchants.length}):\n`;
        merchants.forEach((item, index) => {
          const profileUrl = `https://p2p.binance.com/en/advertiserDetail?advertiserNo=${item.userNo}`;
          const minLimit = formatVND(item.minLimit);
          const maxLimit = formatVND(item.maxLimit);
          message += `${index + 1}. ${item.merchant} - ${formatVND(item.price)}\nLimit: ${minLimit} - ${maxLimit}\n${profileUrl}\n`;
        });
        message += `\n`;
      }
      
      if (users.length > 0) {
        message += `👤 USERS (${users.length}):\n`;
        users.forEach((item, index) => {
          const profileUrl = `https://p2p.binance.com/en/advertiserDetail?advertiserNo=${item.userNo}`;
          const minLimit = formatVND(item.minLimit);
          const maxLimit = formatVND(item.maxLimit);
          message += `${index + 1}. ${item.merchant} - ${formatVND(item.price)}\nLimit: ${minLimit} - ${maxLimit}\n${profileUrl}\n`;
        });
        message += `\n`;
      }
      
      message += `⏰ Thời gian: ${new Date().toLocaleString('vi-VN')}`;
      
      const payload = {
        content: message,
        username: 'Giám Sát Giá P2P'
      };
      
      console.log('📤 Sending Discord webhook with payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log('✅ Discord webhook sent successfully');
      } else {
        const errorText = await response.text();
        console.error('❌ Discord webhook failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Error sending Discord webhook:', error);
    }
  };
  
  // Function to search across all available pages
  // Removed searchAllByAmount function - no longer needed without paging

  // Combined data fetching and auto-refresh functionality
  useEffect(() => {
    // Initialize applied spread values
    if (!appliedSpreadBuy) {
      setAppliedSpreadBuyWithStorage('100');
      setAppliedFormattedSpreadBuyWithStorage('100');
    }
    
    // Initial data fetch - parallel for maximum speed
    console.log('Initial data fetch on component mount (parallel)');
    Promise.all([
      fetchAllP2PData(),
    ]).catch(err => console.error('Initial fetch error:', err));
    
    // Set up countdown timer that also handles refresh
    const interval = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) {
          // When countdown reaches 1, trigger refresh and reset countdown
          console.log('Auto-refreshing P2P data every 15 seconds (ultra-fast: P2P only)');
          // For auto-refresh, prioritize speed - only fetch P2P data
          fetchAllP2PData(true).catch(err => console.error('Auto-refresh error:', err));
          return 15; // Reset to 15 seconds after refresh
        }
        return prev - 1;
      });
    }, 1000);
    
    // Clean up the interval on component unmount
    return () => clearInterval(interval);
  }, [fetchAllP2PData]);

  const handleRefresh = () => {
    console.log('Manual refresh triggered (parallel)');
    Promise.all([
      fetchAllP2PData(),
    ]).catch(err => console.error('Manual refresh error:', err));
    setNextRefresh(15); // Reset the countdown timer
  };

  // Get data without filtering
  const getFilteredData = () => {
    // Return the top 20 buy data from server
    return allP2PData.buy || [];
  };

  const filteredData = getFilteredData();

  // Function to check if price should be highlighted (ALL listings - merchants and users)
  const shouldHighlightPrice = (price, tradeType) => {
    const numericPrice = parseFloat(price);
    
    // Highlight ANY listing (merchant or user) if price is below threshold
    if (tradeType === 'BUY' && previousTop1Merchant && appliedSpreadBuy) {
      const spread = parseFloat(appliedSpreadBuy);
      if (!isNaN(previousTop1Merchant.price) && !isNaN(numericPrice) && !isNaN(spread)) {
        const threshold = previousTop1Merchant.price - spread;
        const isHighlighted = numericPrice < threshold;
        
        if (isHighlighted) {
          console.log(`Price highlighted: ${numericPrice} < ${threshold} (${previousTop1Merchant.price} - ${spread})`);
        }
        
        return isHighlighted;
      }
    }
    
    return false;
  };

  // Check for highlighted items and send webhook notifications (ALL listings - merchants and users)
  useEffect(() => {
    if (!allP2PData.buy) {
      console.log('❌ Discord check: No buy data available');
      return;
    }
    if (loading) {
      console.log('❌ Discord check: Still loading, skipping');
      return;
    }
    
    if (!previousTop1Merchant) {
      console.log('❌ Discord check: No previous top 1 merchant available');
      console.log('   Current top 1 merchant:', currentTop1Merchant);
      console.log('   ℹ️ Need at least 2 data refreshes to establish previous merchant');
      return;
    }
    
    if (!discordEnabled) {
      console.log('❌ Discord check: Discord notifications disabled');
      return;
    }
    
    const currentTime = Date.now();
    const highlightedItems = [];
    
    console.log('\n🔍 === DISCORD NOTIFICATION CHECK (ALL LISTINGS) ===');
    console.log('✅ Previous top 1 merchant:', `${previousTop1Merchant.name} - ${formatVND(previousTop1Merchant.price)}`);
    console.log('✅ Current top 1 merchant:', currentTop1Merchant ? `${currentTop1Merchant.name} - ${formatVND(currentTop1Merchant.price)}` : 'None');
    console.log('✅ Spread threshold:', appliedFormattedSpreadBuy);
    console.log('✅ Discord enabled:', discordEnabled);
    
    const spread = parseFloat(appliedSpreadBuy);
    const threshold = previousTop1Merchant.price - spread;
    console.log(`📊 Alert threshold: ${formatVND(threshold)} (${formatVND(previousTop1Merchant.price)} - ${formatVND(spread)})`);
    
    // Check ALL buy data for highlighting and notify about ALL highlighted listings
    if (allP2PData.buy && allP2PData.buy.length > 0) {
      const allHighlighted = allP2PData.buy.filter(item => shouldHighlightPrice(parseFloat(item.adv.price), 'BUY'));
      const highlightedMerchants = allHighlighted.filter(item => item.advertiser.userType === 'merchant');
      const highlightedUsers = allHighlighted.filter(item => item.advertiser.userType !== 'merchant');
      
      console.log(`🔥 Total highlighted listings: ${allHighlighted.length} (${highlightedMerchants.length} merchants, ${highlightedUsers.length} users)`);
      console.log(`📢 Will notify about ALL ${allHighlighted.length} highlighted listings`);
      
      // Process ALL highlighted listings (merchants and users)
      allHighlighted.forEach((item, index) => {
        const p2pPrice = parseFloat(item.adv.price);
            const itemKey = `BUY-${item.advertiser.userNo}-${p2pPrice}`;
        const isMerchant = item.advertiser.userType === 'merchant';
            
        console.log(`${index + 1}. ${item.advertiser.nickName} (${isMerchant ? 'MERCHANT' : 'USER'}): ${formatVND(p2pPrice)} 🔥`);
        
        // Only add if we haven't notified about this specific price from this user recently
            if (!notifiedPrices.has(itemKey)) {
          console.log(`   ➕ New highlighted ${isMerchant ? 'merchant' : 'user'}: ${item.advertiser.nickName} - ${formatVND(p2pPrice)}`);
              highlightedItems.push({
                type: 'BUY',
                merchant: item.advertiser.nickName,
                price: p2pPrice,
            userNo: item.advertiser.userNo,
            isMerchant: isMerchant,
            minLimit: parseFloat(item.adv.minSingleTransAmount),
            maxLimit: parseFloat(item.adv.maxSingleTransAmount)
              });
        } else {
          console.log(`   ⏭️ Already notified: ${item.advertiser.nickName} - ${formatVND(p2pPrice)}`);
        }
      });
    }
    
    console.log(`📋 Found ${highlightedItems.length} NEW highlighted listings for Discord`);
    
    // Check throttling
    const timeSinceLastNotification = currentTime - lastNotificationTime;
    console.log(`⏰ Time since last notification: ${timeSinceLastNotification}ms (threshold: 15000ms)`);
    
    // Send webhook if Discord is enabled, we have new highlighted items and enough time has passed
    if (discordEnabled && highlightedItems.length > 0 && timeSinceLastNotification > 15000) {
      console.log('🚀 Sending Discord notification...');
      sendDiscordWebhook(highlightedItems);
      setLastNotificationTime(currentTime);
      
      // Update notified prices set
      const newNotifiedPrices = new Set(notifiedPrices);
      highlightedItems.forEach(item => {
        const itemKey = `${item.type}-${item.userNo}-${item.price}`;
        newNotifiedPrices.add(itemKey);
      });
      setNotifiedPrices(newNotifiedPrices);
      
      // Clean up old notifications (keep only last 20)
      if (newNotifiedPrices.size > 100) {
        const pricesArray = Array.from(newNotifiedPrices);
        const recentPrices = pricesArray.slice(-20);
        setNotifiedPrices(new Set(recentPrices));
      }
    } else if (highlightedItems.length > 0 && timeSinceLastNotification <= 15000) {
      console.log(`⏳ Discord notification throttled. Wait ${Math.round((15000 - timeSinceLastNotification) / 1000)} more seconds`);
    } else if (highlightedItems.length === 0) {
      console.log('ℹ️ No new highlighted listings - no Discord notification needed');
    }
    
    console.log('=== END DISCORD CHECK ===\n');
  }, [allP2PData, previousTop1Merchant, appliedSpreadBuy, loading, lastNotificationTime, notifiedPrices, discordEnabled]);

  const renderDataTable = () => {
    // Function to generate Binance P2P URL
    const getBinanceP2PUrl = (item) => {
      const baseUrl = 'https://p2p.binance.com/en/advertiserDetail';
      return `${baseUrl}?advertiserNo=${item.advertiser.userNo}`;
    };

    // Use the helper function for highlighting



    if (loading) {
      return (
        <div className="text-center p-4">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Đang tải...</span>
          </Spinner>
        </div>
      );
    }

    if (error) {
      return (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Lỗi: {error}
        </div>
      );
    }

    if (!filteredData || filteredData.length === 0) {
      return (
        <div className="alert alert-info" role="alert">
          <i className="bi bi-info-circle-fill me-2"></i>
          Không có dữ liệu
        </div>
      );
    }

    return (
      <div className="table-responsive">
        <Table bordered hover className="p2p-table">
          <thead>
            <tr>
              <th>Người Bán</th>
              <th>Giá</th>
              <th>Giới Hạn</th>
              <th>Khả Dụng</th>
              <th>Phương Thức Thanh Toán</th>
              <th>Đơn Hàng</th>
              <th>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => {
              const p2pPrice = parseFloat(item.adv.price);
              const isHighlighted = shouldHighlightPrice(p2pPrice, 'BUY');
              
              return (
                <tr key={index}>
                  <td>
                    <div className="merchant-info">
                      <a 
                        href={getBinanceP2PUrl(item)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="merchant-name-link text-decoration-none"
                        title={`Xem profile của ${item.advertiser.nickName}`}
                      >
                      <span className="merchant-name">{item.advertiser.nickName}</span>
                      </a>
                      {item.advertiser.userType === 'merchant' && (
                        <Badge bg="warning" text="dark" className="ms-2">
                          <i className="bi bi-shop"></i> Merchant
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className={`price-cell ${isHighlighted ? 'price-cell-highlighted' : ''}`}>
                    {formatVND(p2pPrice)}
                    {isHighlighted && (
                      <i className="bi bi-exclamation-triangle-fill ms-1 text-danger price-warning-icon" 
                         title={`Giá thấp hơn top 1 merchant trước - ${appliedFormattedSpreadBuy || '100'}`}></i>
                    )}
                  </td>
                  <td>
                    {formatVND(parseFloat(item.adv.minSingleTransAmount))} - {formatVND(parseFloat(item.adv.maxSingleTransAmount))}
                  </td>
                  <td>
                    {parseFloat(item.adv.surplusAmount).toFixed(2)} USDT
                  </td>
                  <td>
                    {item.adv.tradeMethods?.map((method, idx) => (
                      <Badge key={idx} bg="info" className="me-1 mb-1">
                        {method.identifier}
                      </Badge>
                    ))}
                  </td>
                  <td>{item.advertiser.monthOrderCount}</td>
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      href={getBinanceP2PUrl(item)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <i className="bi bi-box-arrow-up-right me-1"></i>
                      Đến Binance
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  return (
          <div className="top-30-p2p-data">
      <style>{filterStyles}</style>
      <Card className="mb-4">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h4 className="mb-0 d-flex align-items-center">
                <i className="bi bi-lightning-fill me-2 text-warning"></i>
                Dữ Liệu P2P USDT/VND Top 20 (Siêu Nhanh)
              </h4>
              <small className="text-muted mt-1">
                Hiển thị 20 giá mua thấp nhất - tối ưu hóa cho tốc độ (1 lần gọi API)
              </small>
            </div>
            
            <div className="d-flex flex-column align-items-end">
              <Badge bg="success" className="text-white px-3 py-2 auto-refresh-badge mb-2">
                <i className="bi bi-lightning-fill me-1"></i>
                Làm mới siêu nhanh trong <span className="fw-bold">{nextRefresh}</span>s
                {lastRefreshTime && (
                  <div className="small mt-1 opacity-75">
                    Lần làm mới cuối: {lastRefreshTime}
                  </div>
                )}
              </Badge>
              {previousTop1Merchant && (
                <Badge 
                  bg={discordEnabled ? "success" : "secondary"} 
                  className="text-white px-3 py-2 auto-refresh-badge"
                >
                  <i className="bi bi-discord me-1"></i>
                  {discordEnabled ? "Giám Sát Giá Đang Hoạt Động" : "Giám Sát Giá Sẵn Sàng"}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="filter-controls-container">
            <Card className="mb-3 filter-card">
              <Card.Body className="p-4">
                <h5 className="filter-section-title mb-3">
                  <i className="bi bi-funnel-fill me-2"></i>
                  Tùy Chọn Lọc
                </h5>
                
                {/* First Row - Merchant Monitoring and Refresh */}
                <Row className="mb-3 compact-filter-row">
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-clock-history me-2 text-info"></i>
                        <span>Người Bán Top 1 Trước Đó</span>
                      </Form.Label>
                      <div className="d-flex flex-column align-items-center justify-content-center p-2 bg-light rounded">
                        <strong className="text-info text-center">
                          {previousTop1Merchant ? previousTop1Merchant.name : 'Đang chờ người bán...'}
                        </strong>
                        {previousTop1Merchant && (
                          <small className="text-muted">
                            {formatVND(previousTop1Merchant.price)}
                          </small>
                        )}
                      </div>
                    </Form.Group>
                  </Col>
                  
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-arrow-down-circle me-2 text-success"></i>
                        <span>Người Bán Top 1 Hiện Tại</span>
                      </Form.Label>
                      <div className="d-flex flex-column align-items-center justify-content-center p-2 bg-light rounded">
                        <strong className="text-success text-center">
                          {currentTop1Merchant ? currentTop1Merchant.name : 'Đang tải người bán...'}
                        </strong>
                        {currentTop1Merchant && (
                          <small className="text-muted">
                            {formatVND(currentTop1Merchant.price)}
                          </small>
                        )}
                      </div>
                    </Form.Group>
                  </Col>
                  
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-rulers me-2 text-warning"></i>
                        <span>Chênh Lệch Cảnh Báo</span>
                      </Form.Label>
                      <div className="input-group filter-input-group">
                        <span className="input-group-text filter-currency-symbol">₫</span>
                        <Form.Control
                          type="text"
                          placeholder="100"
                          value={formattedSpreadBuy}
                          onChange={handleSpreadBuyChange}
                          disabled={loading}
                          className="text-end filter-amount-input"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              applySpreadBuyFilter();
                            }
                          }}
                        />
                        <Button 
                          variant="primary"
                          onClick={applySpreadBuyFilter}
                          disabled={loading || !spreadBuy}
                          className="filter-search-btn"
                          title="Áp dụng Chênh Lệch"
                        >
                          <i className="bi bi-check-circle"></i>
                        </Button>
                      </div>
                      {appliedSpreadBuy && appliedSpreadBuy !== '100' && (
                        <div className="mt-2">
                          <Badge bg="success" className="spread-badge">
                            <i className="bi bi-check-circle me-1"></i>
                            <span className="me-1">Chênh lệch đã áp dụng:</span> 
                            <span className="fw-bold">₫{appliedFormattedSpreadBuy}</span>
                          </Badge>
                        </div>
                      )}
                    </Form.Group>
                  </Col>
                  
                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-currency-exchange me-2 text-info"></i>
                        <span>Giới Hạn Tối Thiểu</span>
                      </Form.Label>
                      <div className="input-group filter-input-group">
                        <span className="input-group-text filter-currency-symbol">₫</span>
                        <Form.Control
                          type="text"
                          placeholder="Tất cả giới hạn"
                          value={formattedMinLimit}
                          onChange={handleMinLimitChange}
                          disabled={loading}
                          className="text-end filter-amount-input"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              applyMinLimitFilter();
                            }
                          }}
                        />
                        <Button 
                          variant="primary"
                          onClick={applyMinLimitFilter}
                          disabled={loading}
                          className="filter-search-btn"
                          title="Áp dụng Bộ Lọc Giới Hạn Tối Thiểu"
                        >
                          <i className="bi bi-check-circle"></i>
                        </Button>
                      </div>
                      {appliedMinLimit && appliedMinLimit !== '' && (
                        <div className="mt-2">
                          <Badge bg="info" className="spread-badge">
                            <i className="bi bi-check-circle me-1"></i>
                            <span className="me-1">Giới hạn tối thiểu:</span> 
                            <span className="fw-bold">₫{appliedFormattedMinLimit}</span>
                          </Badge>
                        </div>
                      )}
                      {appliedMinLimit === '' && (
                        <div className="mt-2">
                          <Badge bg="secondary" className="spread-badge">
                            <i className="bi bi-info-circle me-1"></i>
                            <span>Tất cả giới hạn (không lọc)</span>
                          </Badge>
                        </div>
                      )}
                    </Form.Group>
                  </Col>

                  <Col md={1}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-arrow-clockwise me-1 text-primary"></i>
                        <span>Làm Mới</span>
                      </Form.Label>
                      <Button 
                        variant="primary" 
                        onClick={handleRefresh} 
                        disabled={loading}
                        className="w-100 filter-search-btn"
                        size="sm"
                        title="Làm mới dữ liệu"
                      >
                        {loading ? (
                          <Spinner animation="border" size="sm" />
                        ) : (
                          <i className="bi bi-arrow-clockwise"></i>
                        )}
                      </Button>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Second Row - Clear Button */}
                <Row className="mb-3 compact-filter-row">
                  <Col md={8}>
                    <Button 
                      variant="outline-danger" 
                      onClick={clearStoredMerchants}
                      disabled={loading}
                      className="filter-clear-btn"
                      title="Đặt lại tất cả bộ lọc và theo dõi người bán"
                    >
                      <i className="bi bi-x-circle me-2"></i>
                      Đặt Lại Tất Cả Bộ Lọc
                    </Button>
                  </Col>
                  <Col md={4}>
                    <div className="d-flex align-items-center justify-content-end">
                      <Badge bg="success" className="me-2">
                        <i className="bi bi-check-circle me-1"></i>
                        Bộ Lọc Tự Động Lưu
                      </Badge>
                      <small className="text-muted">
                        <i className="bi bi-info-circle me-1"></i>
                        Cài đặt được giữ khi làm mới
                      </small>
                    </div>
                  </Col>
                </Row>

                {/* Third Row - View Controls and Discord Alerts */}
                <Row className="mb-2 compact-filter-row">
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-eye me-2 text-primary"></i>
                        <span>Chế Độ Xem Hiện Tại</span>
                      </Form.Label>
                      <div className="d-flex align-items-center justify-content-center p-2 bg-primary text-white rounded">
                        <i className="bi bi-cart me-2"></i>
                        <strong>Lệnh Mua (Giám Sát Người Bán)</strong>
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-discord me-2 text-primary"></i>
                        <span>Thông Báo Discord (Tất Cả Danh Sách)</span>
                      </Form.Label>
                      <div className="d-flex flex-column p-2 bg-light rounded">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <Badge 
                            bg={discordEnabled ? "success" : "danger"} 
                            className="me-2"
                          >
                            {discordEnabled ? "BẬT" : "TẮT"}
                          </Badge>
                          <Form.Check 
                            type="switch"
                            id="discord-toggle"
                            checked={discordEnabled}
                            onChange={(e) => setDiscordEnabledWithStorage(e.target.checked)}
                            className="discord-toggle"
                          />
                        </div>
                        <div className="d-flex gap-2">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={testDiscordWebhook}
                            className="flex-grow-1"
                            title="Kiểm tra webhook Discord"
                          >
                            <i className="bi bi-send me-1"></i>
                            Kiểm tra Discord
                          </Button>
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={debugHighlightingLogic}
                            className="flex-grow-1"
                            title="Gỡ lỗi logic nhấn màu"
                          >
                            <i className="bi bi-bug me-1"></i>
                            Gỡ lỗi
                          </Button>
                        </div>
                        {discordEnabled && (
                          <small className="text-muted mt-2">
                            {previousTop1Merchant ? 
                              `Theo dõi vs ${previousTop1Merchant.name}` : 
                              'Đang chờ người bán top 1 trước...'}
                          </small>
                        )}
                        {discordEnabled && !previousTop1Merchant && (
                          <small className="text-warning mt-2">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            Cần 2 lần làm mới để bắt đầu theo dõi
                          </small>
                        )}
                      </div>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </div>
        </Card.Header>
        <Card.Body>
          {renderDataTable()}
          
          <div className="d-flex justify-content-center align-items-center mt-3">
            <div>
              {!loading && allP2PData.timestamp && (
                <small className="text-muted">
                  Cập nhật lần cuối: {new Date(allP2PData.timestamp).toLocaleString()}
                  {allP2PData.metadata && (
                    <span className="ms-2">
                      • Hiển thị Lệnh Mua: {allP2PData.buy.length} trong top 20 giá mua thấp nhất
                    </span>
                  )}
                  {allP2PData.metadata?.limitInfo && (
                    <div className="mt-1 text-info">
                      <i className="bi bi-info-circle me-1"></i>
                      {allP2PData.metadata.limitInfo}
                    </div>
                  )}
                </small>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AllP2PData; 