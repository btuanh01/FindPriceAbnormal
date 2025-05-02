import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Spinner, Badge, ButtonGroup, ToggleButton, Form, Row, Col, Button } from 'react-bootstrap';
// Try to import formatVND, but also define a local version in case it fails
// import { formatVND } from '../utils/formatters';
import './P2PTracker.css'; // Reusing existing CSS

// Add custom styles for the filter components
const filterStyles = `
  .filter-controls-container {
    margin-top: 15px;
  }
  
  .filter-card {
    border: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border-radius: var(--border-radius);
    transition: all 0.3s ease;
  }
  
  .filter-card:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }
  
  .filter-section-title {
    font-weight: 600;
    color: #4a5568;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }
  
  .filter-select {
    border-radius: var(--border-radius);
    font-weight: 500;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
  }
  
  .filter-select:focus {
    box-shadow: 0 4px 10px rgba(58, 123, 213, 0.1);
    border-color: #3a7bd5;
  }
  
  .input-group.filter-input-group {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    border-radius: var(--border-radius);
    overflow: hidden;
    transition: all 0.2s ease;
    width: 100%;
  }
  
  .filter-input-group:focus-within {
    box-shadow: 0 4px 15px rgba(58, 123, 213, 0.15);
    transform: translateY(-1px);
  }
  
  .filter-currency-symbol {
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    color: white;
    border: none;
    font-weight: bold;
    width: 45px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .filter-amount-input {
    border-left: none;
    font-weight: 500;
    font-size: 1.05rem;
    padding: 0.6rem 1rem;
    background-color: #fff;
  }
  
  .filter-amount-input:focus {
    box-shadow: none;
    border-color: #ced4da;
  }
  
  .filter-clear-btn {
    margin-left: 0;
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    background-color: #fff;
    color: #6c757d;
    transition: all 0.2s ease;
  }
  
  .filter-clear-btn:hover {
    background-color: #f8f9fa;
    color: #dc3545;
  }
  
  .filter-search-btn {
    margin-left: 0;
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    background: linear-gradient(135deg, #3a7bd5, #6c63ff);
    border: none;
    color: white;
    transition: all 0.2s ease;
  }
  
  .filter-search-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #3373c4, #5a52e0);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .filter-search-btn:disabled {
    background: #e9ecef;
    color: #6c757d;
    border: none;
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

  const [allP2PData, setAllP2PData] = useState({ buy: [], sell: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('BUY');
  const [asset, setAsset] = useState('USDT');
  const [fiat, setFiat] = useState('VND');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(10);
  const [error, setError] = useState(null);
  const [spotPrice, setSpotPrice] = useState(null);
  const [spotPriceLoading, setSpotPriceLoading] = useState(true);
  const [nextRefresh, setNextRefresh] = useState(30);
  const [limitFilter, setLimitFilter] = useState('');
  const [formattedLimitFilter, setFormattedLimitFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [appliedFormattedFilter, setAppliedFormattedFilter] = useState('');
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const [searchAllResults, setSearchAllResults] = useState({ buy: [], sell: [] });

  // Supported assets
  const assets = ['USDT', 'BTC', 'ETH', 'BNB', 'BUSD'];
  
  // Supported fiat currencies
  const fiats = ['VND', 'USD', 'EUR', 'GBP', 'CNY', 'JPY', 'KRW', 'RUB'];

  // Define fetchAllP2PData before using it in useEffect
  const fetchAllP2PData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use relative path with proxy configured in package.json
      console.log(`Fetching P2P data from API endpoint: /api/p2p/all?asset=${asset}&fiat=${fiat}&page=${page}&rows=${rows}`);
      
      const response = await fetch(`/api/p2p/all?asset=${asset}&fiat=${fiat}&page=${page}&rows=${rows}`);
      
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
      console.log('Received P2P data:', data);
      
      if ((data.buy && data.buy.length === 0) && (data.sell && data.sell.length === 0)) {
        if (data.error) {
          setError(`Error from server: ${data.error}`);
        } else {
          setError('No data returned from Binance API. Try with a smaller number of rows or a different asset.');
        }
      }
      
      setAllP2PData(data);
    } catch (err) {
      console.error('Error fetching P2P data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [asset, fiat, page, rows]);

  // New function to fetch spot price from CoinGecko
  const fetchSpotPrice = useCallback(async () => {
    try {
      setSpotPriceLoading(true);
      const coinId = getCoinGeckoId(asset);
      const currency = fiat.toLowerCase();
      
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency}`;
      console.log(`Fetching spot price from CoinGecko: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`CoinGecko API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data && data[coinId] && data[coinId][currency]) {
        const price = data[coinId][currency];
        console.log(`Received ${asset} spot price: ${price} ${fiat}`);
        setSpotPrice(price);
      } else {
        console.error('Unexpected CoinGecko response format:', data);
        setSpotPrice(null);
      }
    } catch (err) {
      console.error('Error fetching spot price:', err);
      setSpotPrice(null);
    } finally {
      setSpotPriceLoading(false);
    }
  }, [asset, fiat]);

  // Helper function to map asset symbols to CoinGecko IDs
  const getCoinGeckoId = (assetSymbol) => {
    const mapping = {
      'USDT': 'tether',
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'BNB': 'binancecoin',
      'BUSD': 'binance-usd'
    };
    return mapping[assetSymbol] || assetSymbol.toLowerCase();
  };

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
  
  // Function to handle input change
  const handleLimitFilterChange = (e) => {
    const inputValue = e.target.value;
    
    // Remove all non-numeric characters for the actual value
    const numericValue = inputValue.replace(/[^0-9]/g, '');
    
    // Update the state variables
    setLimitFilter(numericValue);
    setFormattedLimitFilter(formatInputAsVND(numericValue));
  };
  
  // Function to clear the filter
  const clearLimitFilter = () => {
    setLimitFilter('');
    setFormattedLimitFilter('');
    setAppliedFilter('');
    setAppliedFormattedFilter('');
    setSearchAllResults({ buy: [], sell: [] });
    setError(null);
  };
  
  // Function to apply the filter
  const applyFilter = () => {
    if (limitFilter) {
      setAppliedFilter(limitFilter);
      setAppliedFormattedFilter(formattedLimitFilter);
    }
  };

  // Function to search across all available pages
  const searchAllByAmount = async () => {
    if (!limitFilter) return;
    
    try {
      setIsSearchingAll(true);
      setLoading(true);
      setError(null);
      
      // Call the special search-all endpoint with the amount filter
      console.log(`Searching all pages for amount: ${limitFilter}`);
      
      const response = await fetch(`/api/p2p/search-all?asset=${asset}&fiat=${fiat}&amount=${limitFilter}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server responded with status: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received search-all results:', data);
      
      // Update state with search results
      setSearchAllResults(data);
      setAppliedFilter(limitFilter);
      setAppliedFormattedFilter(formattedLimitFilter);
      
      // If no results were found
      if ((data.buy && data.buy.length === 0) && (data.sell && data.sell.length === 0)) {
        setError('No listings found across all pages that accept this transaction amount.');
      }
    } catch (err) {
      console.error('Error searching all pages:', err);
      setError(err.message);
      setSearchAllResults({ buy: [], sell: [] });
    } finally {
      setLoading(false);
      setIsSearchingAll(false);
    }
  };

  // Use the fetchAllP2PData function in useEffect
  useEffect(() => {
    fetchAllP2PData();
    fetchSpotPrice();
  }, [fetchAllP2PData, fetchSpotPrice]);

  // Add auto-refresh functionality
  useEffect(() => {
    // Initial data fetch happens in the effect above
    
    // Set up countdown timer for next refresh
    const countdownInterval = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) {
          return 30; // Reset to 30 seconds after refresh
        }
        return prev - 1;
      });
    }, 1000);
    
    // Set up auto-refresh interval (every 30 seconds)
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing P2P data every 30 seconds');
      fetchAllP2PData();
      fetchSpotPrice();
    }, 30000);
    
    // Clean up the intervals on component unmount
    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchAllP2PData, fetchSpotPrice]);

  const handleRefresh = () => {
    fetchAllP2PData();
    fetchSpotPrice();
    setNextRefresh(30); // Reset the countdown timer
  };

  const handleNextPage = () => {
    setPage(prevPage => prevPage + 1);
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(prevPage => prevPage - 1);
    }
  };

  // Create filtered data based on currently shown trade type and limit filter
  const getFilteredData = () => {
    // If we have search-all results and we're using a filter, use those results
    if (appliedFilter && (searchAllResults.buy.length > 0 || searchAllResults.sell.length > 0)) {
      return activeTab === 'BUY' ? searchAllResults.buy : searchAllResults.sell;
    }
    
    // Otherwise, filter the current page data
    const dataToRender = activeTab === 'BUY' ? allP2PData.buy : allP2PData.sell;
    
    // Apply limit filter if it's set
    if (!appliedFilter) return dataToRender || [];
    
    const filterAmount = parseFloat(appliedFilter);
    if (isNaN(filterAmount)) return dataToRender || [];
    
    return dataToRender ? dataToRender.filter(item => {
      const minLimit = parseFloat(item.adv.minSingleTransAmount);
      const maxLimit = parseFloat(item.adv.maxSingleTransAmount);
      
      // Check if the input amount is within the min-max range
      return filterAmount >= minLimit && filterAmount <= maxLimit;
    }) : [];
  };

  const filteredData = getFilteredData();

  const renderDataTable = (tradeType) => {
    // Function to generate Binance P2P URL
    const getBinanceP2PUrl = (item) => {
      const baseUrl = 'https://p2p.binance.com/en/advertiserDetail';
      return `${baseUrl}?advertiserNo=${item.advertiser.userNo}`;
    };

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
          Error: {error}
        </div>
      );
    }

    if (!filteredData || filteredData.length === 0) {
      // Special message if no data after filtering
      const dataToRender = tradeType === 'BUY' ? allP2PData.buy : allP2PData.sell;
      if (appliedFilter && dataToRender && dataToRender.length > 0) {
        return (
          <div className="alert alert-warning" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            No listings found that accept transactions of ₫{appliedFormattedFilter}. Try a different amount.
          </div>
        );
      }
      
      // General no data message
      return (
        <div className="alert alert-info" role="alert">
          <i className="bi bi-info-circle-fill me-2"></i>
          No data available
        </div>
      );
    }

    return (
      <div className="table-responsive">
        <Table bordered hover className="p2p-table">
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Price</th>
              <th>Limits</th>
              <th>Available</th>
              <th>Payment Methods</th>
              <th>Orders</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => {
              const p2pPrice = parseFloat(item.adv.price);
              
              return (
                <tr key={index}>
                  <td>
                    <div className="merchant-info">
                      <span className="merchant-name">{item.advertiser.nickName}</span>
                      {item.advertiser.userType === 'merchant' && (
                        <Badge bg="warning" text="dark" className="ms-2">
                          <i className="bi bi-shop"></i> Merchant
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="price-cell">
                    {formatVND(p2pPrice)}
                  </td>
                  <td>
                    {formatVND(parseFloat(item.adv.minSingleTransAmount))} - {formatVND(parseFloat(item.adv.maxSingleTransAmount))}
                  </td>
                  <td>
                    {parseFloat(item.adv.surplusAmount).toFixed(2)} {asset}
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
                      Go to Binance
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
    <div className="all-p2p-data">
      <style>{filterStyles}</style>
      <Card className="mb-4">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h4 className="mb-0 d-flex align-items-center">
                <i className="bi bi-currency-exchange me-2"></i>
                All P2P Data
              </h4>
              {spotPrice ? (
                <div className="mt-2 spot-price-indicator">
                  <Badge bg="info" className="me-2">
                    <i className="bi bi-graph-up me-1"></i>
                    Spot Price (CoinGecko)
                  </Badge>
                  <span className="fw-bold spot-price-value">
                    {formatVND(spotPrice)}
                  </span>
                </div>
              ) : spotPriceLoading ? (
                <div className="mt-2">
                  <small>Loading spot price...</small>
                  <Spinner animation="border" size="sm" className="ms-2" />
                </div>
              ) : (
                <div className="mt-2 text-muted">
                  <small>Spot price unavailable</small>
                </div>
              )}
            </div>
            
            <Badge bg="light" className="text-dark px-3 py-2 auto-refresh-badge">
              <i className="bi bi-arrow-repeat me-1"></i>
              Auto-refresh in <span className="fw-bold text-primary">{nextRefresh}</span> seconds
            </Badge>
          </div>
          
          <div className="filter-controls-container">
            <Card className="mb-3 filter-card">
              <Card.Body className="p-3">
                <h5 className="filter-section-title mb-3">
                  <i className="bi bi-funnel-fill me-2 text-primary"></i>
                  Filter Options
                </h5>
                
                <Row>
                  <Col md={6} lg={3}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-currency-bitcoin me-2 text-primary"></i>
                        <span>Asset</span>
                      </Form.Label>
                      <Form.Select 
                        value={asset} 
                        onChange={e => setAsset(e.target.value)}
                        disabled={loading}
                        className="filter-select"
                      >
                        {assets.map(assetOption => (
                          <option key={assetOption} value={assetOption}>{assetOption}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6} lg={3}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-cash me-2 text-primary"></i>
                        <span>Fiat Currency</span>
                      </Form.Label>
                      <Form.Select 
                        value={fiat} 
                        onChange={e => setFiat(e.target.value)}
                        disabled={loading}
                        className="filter-select"
                      >
                        {fiats.map(fiatOption => (
                          <option key={fiatOption} value={fiatOption}>{fiatOption}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6} lg={3}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-cash-coin me-2 text-primary"></i>
                        <span>Transaction Amount</span>
                      </Form.Label>
                      <div className="d-flex">
                        <div className="input-group filter-input-group">
                          <span className="input-group-text filter-currency-symbol">₫</span>
                          <Form.Control
                            type="text"
                            placeholder="Enter amount..."
                            value={formattedLimitFilter}
                            onChange={handleLimitFilterChange}
                            disabled={loading}
                            className="text-end filter-amount-input"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                applyFilter();
                              }
                            }}
                          />
                          <Button
                            variant="primary"
                            onClick={applyFilter}
                            disabled={loading || !limitFilter}
                            className="filter-search-btn"
                            title="Search current page"
                          >
                            <i className="bi bi-search"></i>
                          </Button>
                          {appliedFilter && (
                            <Button 
                              variant="outline-secondary" 
                              onClick={clearLimitFilter}
                              disabled={loading}
                              className="filter-clear-btn"
                              title="Clear filter"
                            >
                              <i className="bi bi-x"></i>
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="d-flex mt-2">
                        <Button
                          variant="outline-primary"
                          onClick={searchAllByAmount}
                          disabled={loading || !limitFilter || isSearchingAll}
                          className="w-100 search-all-btn"
                        >
                          {isSearchingAll ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-1" />
                              Searching...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-search me-1"></i>
                              Search Across All Pages
                            </>
                          )}
                        </Button>
                      </div>
                      <Form.Text className="text-muted filter-help-text">
                        <i className="bi bi-info-circle me-1"></i>
                        {appliedFilter ? 
                          searchAllResults.buy.length > 0 || searchAllResults.sell.length > 0 ?
                            `Found matches across all pages` :
                            `Filtered by ₫${appliedFormattedFilter}` :
                          `Enter amount and search to filter`
                        }
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6} lg={3}>
                    <Form.Group className="mb-3">
                      <Form.Label className="d-flex align-items-center">
                        <i className="bi bi-list-ol me-2 text-primary"></i>
                        <span>Display Options</span>
                      </Form.Label>
                      <div className="d-flex flex-column">
                        <Form.Select 
                          value={rows} 
                          onChange={e => setRows(parseInt(e.target.value))}
                          disabled={loading}
                          className="filter-select mb-2"
                        >
                          <option value="10">10 rows (recommended)</option>
                          <option value="20">20 rows</option>
                        </Form.Select>
                        <div className="d-flex">
                          <Button 
                            variant="outline-primary" 
                            onClick={handlePrevPage} 
                            disabled={loading || page <= 1}
                            className="w-50 me-1"
                            size="sm"
                          >
                            <i className="bi bi-chevron-left"></i> Page {page-1}
                          </Button>
                          <Button 
                            variant="outline-primary" 
                            onClick={handleNextPage}
                            disabled={loading}
                            className="w-50"
                            size="sm"
                          >
                            Page {page+1} <i className="bi bi-chevron-right"></i>
                          </Button>
                        </div>
                      </div>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Row className="mt-2">
                  <Col>
                    <ButtonGroup className="w-100">
                      <ToggleButton
                        id="type-buy"
                        type="radio"
                        variant={activeTab === 'BUY' ? 'primary' : 'outline-primary'}
                        name="activeTab"
                        value="BUY"
                        checked={activeTab === 'BUY'}
                        onChange={e => setActiveTab(e.currentTarget.value)}
                        className="w-50 order-type-btn"
                      >
                        <i className="bi bi-cart me-1"></i> Buy Orders
                      </ToggleButton>
                      <ToggleButton
                        id="type-sell"
                        type="radio"
                        variant={activeTab === 'SELL' ? 'primary' : 'outline-primary'}
                        name="activeTab"
                        value="SELL"
                        checked={activeTab === 'SELL'}
                        onChange={e => setActiveTab(e.currentTarget.value)}
                        className="w-50 order-type-btn"
                      >
                        <i className="bi bi-cash me-1"></i> Sell Orders
                      </ToggleButton>
                    </ButtonGroup>
                  </Col>
                </Row>
                
                <div className="d-flex justify-content-end mt-3">
                  <Button 
                    variant="primary" 
                    onClick={handleRefresh} 
                    disabled={loading}
                    className="refresh-btn"
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i> Refresh Data
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </div>
        </Card.Header>
        <Card.Body>
          {appliedFilter && !isNaN(parseFloat(appliedFilter)) && (
            <div className="active-filter-indicator mb-3">
              <Badge bg="primary" className="filter-badge p-3">
                <i className="bi bi-funnel-fill me-2"></i>
                <span className="me-1">Active filter:</span> 
                <span className="fw-bold">₫{appliedFormattedFilter}</span>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-white p-0 ms-3" 
                  onClick={clearLimitFilter}
                  title="Clear filter"
                >
                  <i className="bi bi-x-circle-fill"></i>
                </Button>
              </Badge>
            </div>
          )}
          
          {renderDataTable(activeTab)}
          
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              {!loading && allP2PData.timestamp && (
                <small className="text-muted">
                  Last updated: {new Date(allP2PData.timestamp).toLocaleString()}
                  {allP2PData.metadata && (
                    <span className="ms-2">
                      • Showing {activeTab === 'BUY' ? 
                        (appliedFilter ? 
                          filteredData.length : 
                          allP2PData.buy.length) : 
                        (appliedFilter ? 
                          filteredData.length : 
                          allP2PData.sell.length)
                      } records 
                      {appliedFilter && (
                        <span className="text-primary">
                          {searchAllResults.buy.length > 0 || searchAllResults.sell.length > 0 ? 
                            ` (searched across all pages)` :
                            ` (filtered from ${activeTab === 'BUY' ? allP2PData.buy.length : allP2PData.sell.length})`
                          }
                        </span>
                      )}
                    </span>
                  )}
                  {allP2PData.metadata?.limitInfo && (
                    <div className="mt-1 text-warning">
                      <i className="bi bi-info-circle me-1"></i>
                      {allP2PData.metadata.limitInfo}
                    </div>
                  )}
                </small>
              )}
            </div>
            <div className="d-flex">
              <Button 
                variant="outline-secondary" 
                onClick={handlePrevPage} 
                disabled={loading || page <= 1}
                className="me-2"
              >
                <i className="bi bi-chevron-left"></i> Prev
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={handleNextPage}
                disabled={loading}
              >
                Next <i className="bi bi-chevron-right"></i>
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AllP2PData; 