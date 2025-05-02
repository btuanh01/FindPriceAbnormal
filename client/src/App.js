import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Container, Row, Col, Table, Badge, Form, Button, Spinner, Card, OverlayTrigger, Tooltip, ButtonGroup, ToggleButton, ProgressBar, Nav, Tab } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import SpotPriceTracker from './components/SpotPriceTracker';
import P2PTracker from './components/P2PTracker';
import MerchantStrategyCenter from './components/MerchantStrategyCenter';
import AllP2PData from './components/AllP2PData';
import { fetchSpotPrice, fetchP2PData } from './services/api';

const SERVER_URL = 'http://localhost:5000';
const socket = io(SERVER_URL);

// Add cache and backoff functionality to avoid rate limiting
const API_CACHE = {
  coingecko: {
    lastFetch: 0,
    data: null,
    retryDelay: 5000, // Start with 5 seconds
    maxRetryDelay: 60000 // Max 1 minute
  }
};

function App() {
  const [anomalies, setAnomalies] = useState([]);
  const [timestamp, setTimestamp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    updateInterval: 60000
  });
  const [newConfig, setNewConfig] = useState({
    updateInterval: 60000
  });
  const [rawData, setRawData] = useState([]);
  const [activeTab, setActiveTab] = useState('all-p2p-data');
  const [merchantStrategy, setMerchantStrategy] = useState({
    recommendation: 'ANALYZING',
    confidence: 'LOW',
    reason: 'Đang phân tích dữ liệu thị trường...',
    btcTrend: {
      direction: 'NEUTRAL',
      value: '0.00%',
      favorsBuying: false,
    },
    spreadCondition: {
      value: '0.00%',
      isWide: false,
      favorsBuying: false,
    },
    timeOfDay: {
      currentSession: 'Unknown', 
      favorsBuying: false,
    },
    competition: {
      buyAdsCount: 0,
      sellAdsCount: 0,
      favorsBuying: false,
    },
    liquidity: {
      buyLiquidity: '0₫',
      sellLiquidity: '0₫', 
      ratio: 50,
      favorsBuying: false,
    },
    lastUpdated: null
  });
  const [strategySettings, setStrategySettings] = useState({
    riskAppetite: 'balanced',
    autoAlert: false
  });
  const [coingeckoSpotPrice, setCoingeckoSpotPrice] = useState(null);
  const [spotPriceHistory, setSpotPriceHistory] = useState([]);
  const [spotPriceLoading, setSpotPriceLoading] = useState(true);
  const [p2pData, setP2PData] = useState([]);
  const [p2pLoading, setP2PLoading] = useState(true);
  const [tradeType, setTradeType] = useState('BUY');
  const [strategyLoading, setStrategyLoading] = useState(true);

  // Connect to socket server
  useEffect(() => {
    fetch(`${SERVER_URL}/api/config`)
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setNewConfig(data);
        return fetch(`${SERVER_URL}/api/anomalies`);
      })
      .then(res => res.json())
      .then(data => {
        const allAnomalies = data.anomalies || [];
        console.log('Total anomalies received:', allAnomalies.length);
        setRawData(allAnomalies);
        setAnomalies(allAnomalies);
        setTimestamp(data.timestamp);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching initial data:', err);
        setLoading(false);
      });

    // Request anomalies with current config when connected
    socket.on('connect', () => {
      socket.emit('request_anomalies');
      console.log('Socket connected, requesting data...');
    });

    // Handle anomalies data
    socket.on('anomalies', (data) => {
      const allAnomalies = Array.isArray(data.anomalies) ? data.anomalies : [];
      console.log('Total anomalies received from socket:', allAnomalies.length);
      setRawData(allAnomalies);
      setAnomalies(allAnomalies);
      setTimestamp(data.timestamp);
      setLoading(false);
    });

    // Handle market decision data
    socket.on('market_decision', (data) => {
      console.log('Received market decision from socket:', data);
      setMerchantStrategy({
        recommendation: data.decision || 'HOLD',
        confidence: data.confidence || 'LOW',
        reason: data.reason || 'Đang phân tích dữ liệu thị trường...',
        btcTrend: {
          direction: data.metrics?.spotTrend || 'NEUTRAL',
          value: data.metrics?.avgDeviation || '0.00%',
          favorsBuying: data.decision === 'BUY'
        },
        spreadCondition: {
          value: data.metrics?.spread || '0.00%',
          isWide: parseFloat(data.metrics?.spread || 0) > 1.5,
          favorsBuying: data.decision === 'BUY'
        },
        timeOfDay: {
          currentSession: 'Thời điểm hiện tại', 
          favorsBuying: data.decision === 'BUY'
        },
        competition: {
          buyAdsCount: data.metrics?.buyLiquidity ? parseInt(data.metrics.buyLiquidity.replace(/[^\d]/g, '')) / 1000000 : 0,
          sellAdsCount: data.metrics?.sellLiquidity ? parseInt(data.metrics.sellLiquidity.replace(/[^\d]/g, '')) / 1000000 : 0,
          favorsBuying: data.decision === 'BUY'
        },
        liquidity: {
          buyLiquidity: data.metrics?.buyLiquidity || '0₫',
          sellLiquidity: data.metrics?.sellLiquidity || '0₫', 
          ratio: 50,
          favorsBuying: data.decision === 'BUY'
        },
        lastUpdated: data.timestamp || new Date().toISOString()
      });
      setStrategyLoading(false);
    });

    return () => {
      socket.off('connect');
      socket.off('anomalies');
      socket.off('market_decision');
    };
  }, []);

  // Separate BUY and SELL anomalies
  const buyAnomalies = anomalies.filter(anomaly => anomaly.tradeType === 'BUY');
  const sellAnomalies = anomalies.filter(anomaly => anomaly.tradeType === 'SELL');

  // Sort anomalies by price
  const sortedBuyAnomalies = [...buyAnomalies].sort((a, b) => {
    const priceA = parseFloat(a.p2pPrice) || 0;
    const priceB = parseFloat(b.p2pPrice) || 0;
    return priceA - priceB; // Sort by price, lowest first for buying
  });

  const sortedSellAnomalies = [...sellAnomalies].sort((a, b) => {
    const priceA = parseFloat(a.p2pPrice) || 0;
    const priceB = parseFloat(b.p2pPrice) || 0;
    return priceB - priceA; // Sort by price, highest first for selling
  });

  // Get top deviations
  const topBuyDeviation = sortedBuyAnomalies.length > 0 ? parseFloat(sortedBuyAnomalies[0].deviation) || 0 : 0;
  const topSellDeviation = sortedSellAnomalies.length > 0 ? parseFloat(sortedSellAnomalies[0].deviation) || 0 : 0;

  console.log('Top Buy Deviation:', topBuyDeviation);
  console.log('Top Sell Deviation:', topSellDeviation);

  // Update config
  const handleConfigUpdate = () => {
    fetch(`${SERVER_URL}/api/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newConfig)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfig(data.config);
        }
      })
      .catch(err => console.error('Error updating config:', err));
  };

  // Format currency as VND
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Get row background color based on deviation
  const getRowColor = (deviation, tradeType) => {
    const absDeviation = Math.abs(deviation);
    
    // Higher the deviation, darker the color
    const intensity = Math.min(1, absDeviation / 5) * 0.7;
    
    // SELL ads with lower price (negative deviation) = good buying opportunity
    if (tradeType === 'SELL' && deviation < 0) {
      return `rgba(40, 167, 69, ${intensity})`;
    } 
    // BUY ads with higher price (positive deviation) = good selling opportunity
    else if (tradeType === 'BUY' && deviation > 0) {
      return `rgba(220, 53, 69, ${intensity})`;
    }
    // Less interesting cases
    return 'transparent';
  };

  // Table component for anomalies
  const AnomalyTable = ({ anomalies, tradeType }) => {
    console.log(`Rendering ${tradeType} table with ${anomalies.length} items`);
    
    // Create URL to Binance P2P advertiser profile
    const getAdvertiserProfileUrl = (advertiserId) => {
      if (!advertiserId) return null;
      
      // URL for Binance P2P advertiser profile
      return `https://p2p.binance.com/en/advertiserDetail?advertiserNo=${advertiserId}`;
    };
    
    return (
    <div className="table-wrapper">
      <Table bordered hover responsive className="anomaly-table">
        <thead>
          <tr>
              <th>Người giao dịch</th>
            <th>Đơn hàng</th>
            <th>Giá P2P</th>
            <th>Giá Spot</th>
            <th>Chênh lệch</th>
            <th>Thanh toán</th>
            <th>Xem giao dịch</th>
          </tr>
        </thead>
        <tbody>
            {anomalies.length > 0 ? (
              anomalies.map((anomaly, index) => (
                <tr key={index} style={{ backgroundColor: getRowColor(anomaly.deviation, tradeType) }}>
                <td className="text-nowrap">
                  <div className="merchant-name">
                    {anomaly.merchantName}
                    {anomaly.isVerified && 
                      <Badge bg="primary" className="ms-1 verified-badge" pill>
                        <i className="bi bi-patch-check-fill"></i>
                      </Badge>
                    }
                  </div>
                </td>
                <td>
                  <span className="completion-rate">
                    {anomaly.orderCount} / {(anomaly.completionRate * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="price-cell">{formatVND(anomaly.p2pPrice)}</td>
                  <td className="price-cell">
                    {anomaly.actualSpotPrice ? (
                      <OverlayTrigger
                        placement="top"
                        overlay={
                          <Tooltip id={`tooltip-spot-${index}`}>
                            Giá từ CoinGecko: {formatVND(anomaly.actualSpotPrice)}
                            {anomaly.spotPrice !== anomaly.actualSpotPrice && (
                              <><br />Giá từ server: {formatVND(anomaly.spotPrice)}</>
                            )}
                          </Tooltip>
                        }
                      >
                        <span className="coingecko-price">{formatVND(anomaly.actualSpotPrice)}</span>
                      </OverlayTrigger>
                    ) : (
                      formatVND(anomaly.spotPrice)
                    )}
                  </td>
                  <td>
                    <span className={`deviation-value ${anomaly.deviation > 0 ? 'positive' : 'negative'}`}>
                      {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(2)}%
                  </span>
                </td>
                <td>
                  {anomaly.paymentMethods.slice(0, 2).map((method, i) => (
                    <Badge key={i} bg="secondary" className="me-1 payment-badge">
                      {method}
                    </Badge>
                  ))}
                  {anomaly.paymentMethods.length > 2 && (
                    <Badge bg="secondary" className="payment-badge">+{anomaly.paymentMethods.length - 2}</Badge>
                  )}
                </td>
                <td>
                  {anomaly.advertiserId ? (
                    <a 
                      href={getAdvertiserProfileUrl(anomaly.advertiserId)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-primary btn-sm"
                    >
                      <i className="bi bi-person me-1"></i> Xem P2P
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center py-4">
                {loading ? (
                  <div className="loading-indicator">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Đang tải...
                  </div>
                ) : (
                  <div className="no-data">
                    <span>Không có dữ liệu nào cho lệnh {tradeType === 'SELL' ? 'bán' : 'mua'} USDT</span>
                  </div>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
        {coingeckoSpotPrice && (
          <div className="mt-2 text-end">
            <small className="text-muted">
              Giá Spot từ CoinGecko: {formatVND(coingeckoSpotPrice)}
            </small>
          </div>
        )}
                  </div>
    );
  };

  // MerchantStrategyCenter component
  const MerchantStrategyCenter = ({ strategy, settings, setSettings }) => {
    const getRecommendationColor = (recommendation) => {
      switch (recommendation) {
        case 'BUY': return '#0d6efd'; // Blue
        case 'SELL': return '#28a745'; // Green
        case 'HOLD': return '#6c757d'; // Gray
        case 'ANALYZING': return '#17a2b8'; // Info blue
        default: return '#6c757d';
      }
    };
    
    const getConfidenceBadge = (confidence) => {
      switch (confidence) {
        case 'HIGH': 
          return <Badge bg="success" className="confidence-badge">Độ tin cậy cao</Badge>;
        case 'MEDIUM': 
          return <Badge bg="warning" className="confidence-badge">Độ tin cậy trung bình</Badge>;
        case 'LOW': 
          return <Badge bg="secondary" className="confidence-badge">Độ tin cậy thấp</Badge>;
        default: 
          return <Badge bg="secondary" className="confidence-badge">Không xác định</Badge>;
      }
    };
    
    const getTrendIcon = (direction) => {
      switch (direction) {
        case 'UP': return <i className="bi bi-arrow-up-circle-fill text-success me-1"></i>;
        case 'DOWN': return <i className="bi bi-arrow-down-circle-fill text-danger me-1"></i>;
        case 'NEUTRAL': return <i className="bi bi-dash-circle-fill text-secondary me-1"></i>;
        default: return <i className="bi bi-question-circle-fill text-secondary me-1"></i>;
      }
    };
    
    const renderRecommendationBox = () => {
      const recommendationStyle = {
        backgroundColor: getRecommendationColor(strategy.recommendation),
        padding: '1.5rem',
        borderRadius: '0.5rem',
        color: 'white',
        textAlign: 'center',
        marginBottom: '1.5rem'
      };
      
      return (
        <div style={recommendationStyle} className="recommendation-box">
          <h2 className="mb-1">
            {strategy.recommendation === 'BUY' && (
              <><i className="bi bi-megaphone-fill me-2"></i> ĐĂNG QUẢNG CÁO MUA</>
            )}
            {strategy.recommendation === 'SELL' && (
              <><i className="bi bi-megaphone-fill me-2"></i> ĐĂNG QUẢNG CÁO BÁN</>
            )}
            {strategy.recommendation === 'HOLD' && (
              <><i className="bi bi-hand-thumbs-up-fill me-2"></i> TẠM DỪNG ĐĂNG QUẢNG CÁO</>
            )}
            {strategy.recommendation === 'ANALYZING' && (
              <><i className="bi bi-gear-fill me-2"></i> ĐANG PHÂN TÍCH CHIẾN LƯỢC</>
            )}
          </h2>
          <div className="mt-2 mb-2">
            {getConfidenceBadge(strategy.confidence)}
          </div>
          <p className="mb-0">{strategy.reason}</p>
        </div>
      );
    };
    
    const renderBtcTrendCard = () => {
      return (
        <Card className="mb-3 strategy-card">
          <Card.Header className={strategy.btcTrend.favorsBuying ? 'buying-bias' : 'selling-bias'}>
            <h5 className="mb-0">
              <i className="bi bi-currency-bitcoin me-2"></i>
              Xu hướng BTC/USDT
            </h5>
          </Card.Header>
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="strategy-label">Hướng di chuyển hiện tại</div>
                <div className="strategy-value d-flex align-items-center">
                  {getTrendIcon(strategy.btcTrend.direction)}
                  {strategy.btcTrend.direction === 'UP' && 'Đang tăng'}
                  {strategy.btcTrend.direction === 'DOWN' && 'Đang giảm'}
                  {strategy.btcTrend.direction === 'NEUTRAL' && 'Đi ngang'}
                </div>
              </div>
              <div>
                <div className="strategy-label">Biến động</div>
                <div className={`strategy-value ${strategy.btcTrend.direction === 'UP' ? 'text-success' : strategy.btcTrend.direction === 'DOWN' ? 'text-danger' : 'text-secondary'}`}>
                  {strategy.btcTrend.value}
                </div>
              </div>
            </div>
            
            <div className="strategy-insight mt-3">
              <div className="strategy-label">Ảnh hưởng đến chiến lược</div>
              <div className={`insight-card ${strategy.btcTrend.favorsBuying ? 'buy-insight' : 'sell-insight'}`}>
                {strategy.btcTrend.favorsBuying ? (
                  <><i className="bi bi-cart me-1"></i> Thuận lợi cho đăng quảng cáo <strong>MUA</strong></>
                ) : (
                  <><i className="bi bi-cash-coin me-1"></i> Thuận lợi cho đăng quảng cáo <strong>BÁN</strong></>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>
      );
    };
    
    const renderSpreadCard = () => {
      return (
        <Card className="mb-3 strategy-card">
          <Card.Header className={strategy.spreadCondition.favorsBuying ? 'buying-bias' : 'selling-bias'}>
            <h5 className="mb-0">
              <i className="bi bi-arrows-expand me-2"></i>
              Khoảng Cách P2P
            </h5>
          </Card.Header>
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="strategy-label">Khoảng cách hiện tại</div>
                <div className="strategy-value">
                  {strategy.spreadCondition.value}
                </div>
              </div>
              <div>
                <div className="strategy-label">Trạng thái</div>
                <div className="strategy-value">
                  <Badge bg={strategy.spreadCondition.isWide ? 'info' : 'warning'}>
                    {strategy.spreadCondition.isWide ? 'RỘNG' : 'HẸP'}
                      </Badge>
                </div>
              </div>
            </div>
            
            <div className="strategy-insight mt-3">
              <div className="strategy-label">Ảnh hưởng đến chiến lược</div>
              <div className={`insight-card ${strategy.spreadCondition.favorsBuying ? 'buy-insight' : 'sell-insight'}`}>
                {strategy.spreadCondition.favorsBuying ? (
                  <><i className="bi bi-cart me-1"></i> Thuận lợi cho đăng quảng cáo <strong>MUA</strong></>
                ) : (
                  <><i className="bi bi-cash-coin me-1"></i> Thuận lợi cho đăng quảng cáo <strong>BÁN</strong></>
                    )}
                  </div>
                </div>
          </Card.Body>
        </Card>
      );
    };
    
    const renderTimeSessionCard = () => {
      return (
        <Card className="mb-3 strategy-card">
          <Card.Header className={strategy.timeOfDay.favorsBuying ? 'buying-bias' : 'selling-bias'}>
            <h5 className="mb-0">
              <i className="bi bi-clock-history me-2"></i>
              Phiên Giao Dịch
            </h5>
              </Card.Header>
          <Card.Body>
            <div className="session-info">
              <div className="strategy-label">Phiên hiện tại</div>
              <div className="strategy-value">
                {strategy.timeOfDay.currentSession}
              </div>
            </div>
            
            <div className="strategy-insight mt-3">
              <div className="strategy-label">Ảnh hưởng đến chiến lược</div>
              <div className={`insight-card ${strategy.timeOfDay.favorsBuying ? 'buy-insight' : 'sell-insight'}`}>
                {strategy.timeOfDay.favorsBuying ? (
                  <><i className="bi bi-cart me-1"></i> Thuận lợi cho đăng quảng cáo <strong>MUA</strong></>
                ) : (
                  <><i className="bi bi-cash-coin me-1"></i> Thuận lợi cho đăng quảng cáo <strong>BÁN</strong></>
                )}
              </div>
            </div>
          </Card.Body>
            </Card>
      );
    };
    
    const renderCompetitionCard = () => {
      return (
        <Card className="mb-3 strategy-card">
          <Card.Header className={strategy.competition.favorsBuying ? 'buying-bias' : 'selling-bias'}>
            <h5 className="mb-0">
              <i className="bi bi-people-fill me-2"></i>
              Phân Tích Cạnh Tranh
            </h5>
          </Card.Header>
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="strategy-label">Quảng cáo MUA</div>
                <div className="strategy-value text-primary">
                  <i className="bi bi-cart-fill me-1"></i> {strategy.competition.buyAdsCount}
                </div>
              </div>
              <div>
                <div className="strategy-label">Quảng cáo BÁN</div>
                <div className="strategy-value text-success">
                  <i className="bi bi-cash-coin me-1"></i> {strategy.competition.sellAdsCount}
                </div>
              </div>
            </div>
            
            <div className="competition-ratio mt-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span>Tỷ lệ cạnh tranh</span>
                <span>MUA {strategy.competition.buyAdsCount} : {strategy.competition.sellAdsCount} BÁN</span>
              </div>
              <ProgressBar>
                <ProgressBar 
                  variant="primary" 
                  now={strategy.competition.buyAdsCount / (strategy.competition.buyAdsCount + strategy.competition.sellAdsCount || 1) * 100} 
                  key={1} 
                />
                <ProgressBar 
                  variant="success" 
                  now={strategy.competition.sellAdsCount / (strategy.competition.buyAdsCount + strategy.competition.sellAdsCount || 1) * 100} 
                  key={2} 
                />
              </ProgressBar>
            </div>
            
            <div className="strategy-insight mt-3">
              <div className="strategy-label">Ảnh hưởng đến chiến lược</div>
              <div className={`insight-card ${strategy.competition.favorsBuying ? 'buy-insight' : 'sell-insight'}`}>
                {strategy.competition.favorsBuying ? (
                  <><i className="bi bi-cart me-1"></i> Thuận lợi cho đăng quảng cáo <strong>MUA</strong></>
                ) : (
                  <><i className="bi bi-cash-coin me-1"></i> Thuận lợi cho đăng quảng cáo <strong>BÁN</strong></>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>
      );
    };
    
    const renderLiquidityCard = () => {
      return (
        <Card className="mb-3 strategy-card">
          <Card.Header className={strategy.liquidity.favorsBuying ? 'buying-bias' : 'selling-bias'}>
            <h5 className="mb-0">
              <i className="bi bi-water me-2"></i>
              Phân Tích Thanh Khoản
            </h5>
          </Card.Header>
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="strategy-label">Thanh khoản MUA</div>
                <div className="strategy-value">
                  {strategy.liquidity.buyLiquidity}
                </div>
              </div>
              <div>
                <div className="strategy-label">Thanh khoản BÁN</div>
                <div className="strategy-value">
                  {strategy.liquidity.sellLiquidity}
                </div>
              </div>
            </div>
            
            <div className="liquidity-health mt-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span>Cân bằng thanh khoản</span>
                <span>{strategy.liquidity.ratio}%</span>
              </div>
              <ProgressBar 
                variant={strategy.liquidity.ratio > 66 ? "success" : strategy.liquidity.ratio > 33 ? "warning" : "danger"}
                now={strategy.liquidity.ratio} 
              />
            </div>
            
            <div className="strategy-insight mt-3">
              <div className="strategy-label">Ảnh hưởng đến chiến lược</div>
              <div className={`insight-card ${strategy.liquidity.favorsBuying ? 'buy-insight' : 'sell-insight'}`}>
                {strategy.liquidity.favorsBuying ? (
                  <><i className="bi bi-cart me-1"></i> Thuận lợi cho đăng quảng cáo <strong>MUA</strong></>
                ) : (
                  <><i className="bi bi-cash-coin me-1"></i> Thuận lợi cho đăng quảng cáo <strong>BÁN</strong></>
                )}
              </div>
            </div>
          </Card.Body>
        </Card>
      );
    };
    
    const renderSettings = () => {
      return (
        <Card className="mb-3">
          <Card.Header>
            <h5 className="mb-0">
              <i className="bi bi-sliders me-2"></i>
              Tùy Chỉnh Chiến Lược
            </h5>
          </Card.Header>
          <Card.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Mức độ rủi ro chấp nhận</Form.Label>
                <div>
                  <ButtonGroup>
                    <ToggleButton
                      id="risk-safe"
                      type="radio"
                      variant="outline-success"
                      name="risk"
                      value="safe"
                      checked={settings.riskAppetite === "safe"}
                      onChange={(e) => setSettings({...settings, riskAppetite: e.currentTarget.value})}
                    >
                      <i className="bi bi-shield-fill-check me-1"></i> An toàn
                    </ToggleButton>
                    <ToggleButton
                      id="risk-balanced"
                      type="radio"
                      variant="outline-warning"
                      name="risk"
                      value="balanced"
                      checked={settings.riskAppetite === "balanced"}
                      onChange={(e) => setSettings({...settings, riskAppetite: e.currentTarget.value})}
                    >
                      <i className="bi bi-ui-radios-grid me-1"></i> Cân bằng
                    </ToggleButton>
                    <ToggleButton
                      id="risk-aggressive"
                      type="radio"
                      variant="outline-danger"
                      name="risk"
                      value="aggressive"
                      checked={settings.riskAppetite === "aggressive"}
                      onChange={(e) => setSettings({...settings, riskAppetite: e.currentTarget.value})}
                    >
                      <i className="bi bi-lightning-fill me-1"></i> Tích cực
                    </ToggleButton>
                  </ButtonGroup>
                </div>
              </Form.Group>
              
              <Form.Group className="mb-0">
                <Form.Check 
                  type="switch"
                  id="auto-alert-switch"
                  label="Tự động thông báo khi có thời điểm tốt (Chức năng sắp có)"
                  checked={settings.autoAlert}
                  onChange={(e) => setSettings({...settings, autoAlert: e.target.checked})}
                  disabled={true}
                />
              </Form.Group>
            </Form>
          </Card.Body>
        </Card>
      );
    };

    return (
      <div className="merchant-strategy-container">
        {renderRecommendationBox()}
        
        <Row>
          <Col lg={8}>
            <Row>
              <Col md={6}>
                {renderBtcTrendCard()}
              </Col>
              <Col md={6}>
                {renderSpreadCard()}
          </Col>
        </Row>
          <Row>
              <Col md={4}>
                {renderTimeSessionCard()}
              </Col>
              <Col md={8}>
                {renderCompetitionCard()}
            </Col>
          </Row>
          </Col>
          <Col lg={4}>
            {renderLiquidityCard()}
            {renderSettings()}
            
            <Card className="last-updated-card">
              <Card.Body className="py-2">
                <small className="text-muted">
                  <i className="bi bi-clock-history me-1"></i>
                  Cập nhật lần cuối: {strategy.lastUpdated ? new Date(strategy.lastUpdated).toLocaleTimeString() : 'Chưa cập nhật'}
                </small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  // Update fetchBinanceData function to be more reliable and become the primary source
  const fetchBinanceData = async () => {
    try {
      // Use the server as a proxy for Binance API calls to avoid CORS issues
      const response = await fetch(`${SERVER_URL}/api/binance-data`);
      const data = await response.json();
      
      if (!data || data.error) {
        throw new Error(data?.error || 'Failed to fetch Binance data from server proxy');
      }
      
      return {
        btcPrice: data.btcPrice,
        priceChangePercent: data.priceChangePercent,
        buyLiquidity: data.buyLiquidity,
        sellLiquidity: data.sellLiquidity,
        usdtToVndRate: data.usdtToVndRate,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      return null;
    }
  };

  // Update our CoinGecko fetch function to use caching and backoff to avoid rate limits
  const fetchCoingeckoWithBackoff = async () => {
    const now = Date.now();
    const timeSinceLastFetch = now - API_CACHE.coingecko.lastFetch;
    
    // If we've fetched recently, return cached data
    if (timeSinceLastFetch < API_CACHE.coingecko.retryDelay && API_CACHE.coingecko.data) {
      console.log(`Using cached CoinGecko data - next refresh in ${Math.round((API_CACHE.coingecko.retryDelay - timeSinceLastFetch)/1000)}s`);
      return API_CACHE.coingecko.data;
    }
    
    try {
      console.log('Fetching fresh data from CoinGecko...');
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether,bitcoin&vs_currencies=vnd,usd&include_24hr_change=true');
      const data = await response.json();
      
      if (data && data.tether && data.tether.vnd) {
        // Reset backoff on success
        API_CACHE.coingecko.retryDelay = 5000;
        API_CACHE.coingecko.data = data;
        API_CACHE.coingecko.lastFetch = now;
        return data;
      } else {
        throw new Error('Invalid CoinGecko response');
      }
    } catch (error) {
      console.error('CoinGecko API error:', error);
      
      // If we got a rate limit error, increase backoff
      if (error.message && error.message.includes('429')) {
        API_CACHE.coingecko.retryDelay = Math.min(
          API_CACHE.coingecko.retryDelay * 2,
          API_CACHE.coingecko.maxRetryDelay
        );
        console.log(`Rate limited! Increased CoinGecko backoff to ${API_CACHE.coingecko.retryDelay}ms`);
      }
      
      // Return cached data or null
      return API_CACHE.coingecko.data;
    }
  };

  // Add a new utility function for P2P data (using a proxy or CORS-ready endpoint)
  const fetchP2PData = async (tradeType) => {
    try {
      // Since the P2P API needs a POST request with specific headers,
      // this should be proxied through your server.
      // Here we'll use our existing server endpoint which already does this
      const p2pResponse = await fetch(`${SERVER_URL}/api/decision`);
      const p2pData = await p2pResponse.json();
      
      return p2pData;
    } catch (error) {
      console.error('Error fetching P2P data:', error);
      return null;
    }
  };

  // Replace the merchant strategy useEffect with this more direct implementation
  useEffect(() => {
    // Only run if we're on the merchant-strategy tab
    if (activeTab !== 'merchant-strategy') return;

    console.log("Market analysis tab active, fetching real Binance data...");
    
    // Function to get current Vietnam time (UTC+7)
    const getVietnamTime = () => {
      const now = new Date();
      const utcMillis = now.getTime() + (now.getTimezoneOffset() * 60000);
      const vietnamOffset = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds
      return new Date(utcMillis + vietnamOffset);
    };
    
    // Function to update merchant strategy with real Binance data
    const updateMerchantStrategy = async () => {
      try {
        console.log("Updating merchant strategy...");
        
        // First try to fetch BTC trend data from our new API endpoint
        let btcTrendData = null;
        try {
          const btcTrendResponse = await fetch(`${SERVER_URL}/api/btc-trend`);
          btcTrendData = await btcTrendResponse.json();
          console.log("BTC trend data from API:", btcTrendData);
        } catch (btcErr) {
          console.log("Failed to fetch BTC trend data from API:", btcErr);
        }
        
        // Fetch data directly from Binance
        const binanceData = await fetchBinanceData();
        
        // If we couldn't get Binance data, abort
        if (!binanceData) {
          console.log("Cannot update merchant strategy: Failed to fetch Binance data");
          return;
        }
        
        console.log("Received real-time Binance data:", binanceData);
        
        // Also get P2P data from our server (which fetches from Binance P2P)
        const p2pData = await fetchP2PData(tradeType);
        
        // Combine both data sources
        
        // 1. BTC trend from our API endpoint (if available), otherwise from Binance price change data
        const btcTrend = {
          direction: btcTrendData ? 
                     btcTrendData.trend : 
                     (binanceData.priceChangePercent > 0.2 ? 'UP' : 
                     binanceData.priceChangePercent < -0.2 ? 'DOWN' : 'NEUTRAL'),
          value: btcTrendData ? 
                `${btcTrendData.change24h}%` :
                `${binanceData.priceChangePercent.toFixed(2)}%`,
          favorsBuying: btcTrendData ? 
                        btcTrendData.trend === 'DOWN' : 
                        binanceData.priceChangePercent < -0.1 // Down = favor buying
        };
        
        // 2. P2P spread from market decision data
        let spreadCondition = {
          value: '0.00%',
          isWide: false,
          favorsBuying: false
        };
        
        if (p2pData && p2pData.metrics && p2pData.metrics.spread) {
          const spreadValue = p2pData.metrics.spread;
          const numericSpread = parseFloat(spreadValue);
          spreadCondition = {
            value: spreadValue,
            isWide: numericSpread > 1.5, // >1.5% is considered wide
            favorsBuying: numericSpread > 1.5 // Wide spread = favor buying
          };
        }
        
        // 3. Time of day analysis based on real Vietnam time
        const vietnam = getVietnamTime();
        const hours = vietnam.getHours();
        let currentSession = '';
        let timeFavorsBuying = false;
        
        if (hours >= 9 && hours < 11) {
          currentSession = 'Sáng (9h-11h): Nhu cầu cao';
          timeFavorsBuying = false; // Favors selling in morning
        } else if (hours >= 15 && hours < 18) {
          currentSession = 'Chiều (15h-18h): Cung cao';
          timeFavorsBuying = true; // Favors buying in afternoon
        } else if (hours >= 20 && hours < 23) {
          currentSession = 'Tối (20h-23h): Biến động cao';
          // For evening, use the BTC trend to decide
          timeFavorsBuying = btcTrend.favorsBuying;
        } else {
          currentSession = 'Thời gian bình thường';
            timeFavorsBuying = false;
        }
        
        // 4. Competition analysis based on real market data
        // We'll use the difference between buy and sell liquidity from Binance order book
        const competitionFavorsBuying = binanceData.sellLiquidity > binanceData.buyLiquidity;
        
        const competition = {
          buyAdsCount: p2pData?.metrics?.buyLiquidity ? parseInt(p2pData.metrics.buyLiquidity.replace(/[^\d]/g, '')) / 1000000 : Math.round(binanceData.buyLiquidity),
          sellAdsCount: p2pData?.metrics?.sellLiquidity ? parseInt(p2pData.metrics.sellLiquidity.replace(/[^\d]/g, '')) / 1000000 : Math.round(binanceData.sellLiquidity),
          favorsBuying: competitionFavorsBuying
        };
        
        // 5. Liquidity snapshot from Binance order book
        const totalLiquidity = binanceData.buyLiquidity + binanceData.sellLiquidity;
        const buyRatio = totalLiquidity > 0 ? (binanceData.buyLiquidity / totalLiquidity) * 100 : 50;
        
        const liquidity = {
          buyLiquidity: new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
          }).format(binanceData.buyLiquidity * binanceData.btcPrice * binanceData.usdtToVndRate),
          sellLiquidity: new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
          }).format(binanceData.sellLiquidity * binanceData.btcPrice * binanceData.usdtToVndRate),
          ratio: Math.round(buyRatio),
          favorsBuying: buyRatio < 45 // Low buy ratio = favor buying (undersupply)
        };
        
        // Decision rules - Count factors favoring each action
        const buyFactors = [
          btcTrend.favorsBuying,
          spreadCondition.favorsBuying,
          timeFavorsBuying,
          competitionFavorsBuying,
          liquidity.favorsBuying
        ].filter(Boolean).length;
        
        const sellFactors = 5 - buyFactors; // Out of 5 total factors
        
        // Determine recommendation based on majority and risk appetite
        let recommendation, confidence, reason;
        
        // Risk appetite affects decision threshold
        const riskSettings = {
          safe: { buyThreshold: 4, sellThreshold: 4 },
          balanced: { buyThreshold: 3, sellThreshold: 3 },
          aggressive: { buyThreshold: 2, sellThreshold: 2 }
        };
        
        const thresholds = riskSettings[strategySettings.riskAppetite];
        
        if (buyFactors >= thresholds.buyThreshold) {
          recommendation = 'BUY';
          reason = 'Điều kiện thuận lợi để đăng quảng cáo mua USDT với giá tốt.';
          confidence = buyFactors >= 4 ? 'HIGH' : (buyFactors >= 3 ? 'MEDIUM' : 'LOW');
        } else if (sellFactors >= thresholds.sellThreshold) {
          recommendation = 'SELL';
          reason = 'Điều kiện thuận lợi để đăng quảng cáo bán USDT với giá cao.';
          confidence = sellFactors >= 4 ? 'HIGH' : (sellFactors >= 3 ? 'MEDIUM' : 'LOW');
        } else {
          recommendation = 'HOLD';
          reason = 'Thị trường không có ưu thế rõ ràng, nên chờ thời điểm tốt hơn.';
          confidence = 'MEDIUM';
        }
        
        // Update state with real Binance data
        setMerchantStrategy({
          recommendation,
          confidence,
          reason,
          btcTrend,
          spreadCondition,
          timeOfDay: {
            currentSession,
            favorsBuying: timeFavorsBuying
          },
          competition,
          liquidity,
          lastUpdated: new Date()
        });
        
        console.log("Merchant strategy updated with real Binance data");
      } catch (error) {
        console.error("Error updating merchant strategy with Binance data:", error);
      }
    };
    
    // Initial update
    updateMerchantStrategy();
    
    // Set up interval to refresh every 60 seconds
    const intervalId = setInterval(updateMerchantStrategy, 60000);
    return () => clearInterval(intervalId);
  }, [activeTab, strategySettings.riskAppetite, tradeType]);

  // Update useEffect for Anomaly table to use our backoff mechanism
  useEffect(() => {
    // Function to fetch USDT/VND price with reliable fallbacks
    const fetchUsdtPrice = async () => {
      try {
        // Try Binance first (higher rate limits)
        const binanceData = await fetchBinanceData();
        if (binanceData && binanceData.usdtToVndRate) {
          setCoingeckoSpotPrice(binanceData.usdtToVndRate);
          return;
        }
        
        // If Binance fails, try CoinGecko with backoff strategy
        const coingeckoData = await fetchCoingeckoWithBackoff();
        if (coingeckoData && coingeckoData.tether && coingeckoData.tether.vnd) {
          setCoingeckoSpotPrice(coingeckoData.tether.vnd);
        }
      } catch (error) {
        console.error('Error fetching USDT price for anomaly table:', error);
      }
    };
    
    // Fetch initial price
    fetchUsdtPrice();
    
    // Set up interval to refresh price every 60 seconds
    const intervalId = setInterval(fetchUsdtPrice, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Add new useEffect for spot price tracking
  useEffect(() => {
    const fetchData = async () => {
      try {
        const spotPriceData = await fetchSpotPrice();
        setCoingeckoSpotPrice(spotPriceData.price);
        setSpotPriceHistory(prev => {
          const newHistory = [...prev, spotPriceData];
          // Keep only last 24 hours of data
          const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
          return newHistory.filter(item => item.timestamp > oneDayAgo);
        });
        setSpotPriceLoading(false);
      } catch (error) {
        console.error('Error in spot price fetch:', error);
        setSpotPriceLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchP2P = async () => {
      try {
        setP2PLoading(true);
        const data = await fetchP2PData(tradeType);
        
        // Ensure data is an array before mapping
        if (data && Array.isArray(data)) {
          // Process P2P data to include spot price comparison
          const processedData = data.map(item => ({
            ...item,
            spotPrice: coingeckoSpotPrice,
            merchantName: item.advertiser?.nickName || 'Unknown',
            completionRate: (item.advertiser?.monthFinishRate * 100).toFixed(0) || 0,
            price: parseFloat(item.adv?.price) || 0,
            minAmount: parseFloat(item.adv?.minSingleTransAmount) || 0,
            maxAmount: parseFloat(item.adv?.maxSingleTransAmount) || 0,
            paymentMethods: item.adv?.tradeMethods?.map(method => method.identifier) || [],
            completedOrders: item.advertiser?.monthOrderCount || 0,
            totalOrders: item.advertiser?.monthOrderCount || 0,
            timestamp: new Date().toISOString()
          }));
          setP2PData(processedData);
        } else {
          console.warn('No P2P data available or invalid format');
          setP2PData([]);
        }
      } catch (error) {
        console.error('Error in P2P data fetch:', error);
        setP2PData([]);
      } finally {
        setP2PLoading(false);
      }
    };

    fetchP2P();
    const interval = setInterval(fetchP2P, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [coingeckoSpotPrice, tradeType]);

  return (
    <Container fluid className="p-4 main-container">
      <header className="mb-4">
        <h1 className="text-center mb-2">
          <i className="bi bi-graph-up-arrow me-2"></i>
          <span className="app-name">Binance P2P Dashboard</span>
        </h1>
        <p className="text-center text-muted">
          Phân tích giá trị giao dịch P2P Binance thị trường Việt Nam 
          <Badge bg="info" className="ms-2">
            Beta
          </Badge>
        </p>
      </header>
            
      <Tab.Container id="dashboard-tabs" activeKey={activeTab} onSelect={setActiveTab}>
        <Row className="mb-3">
          <Col>
            <Nav variant="tabs" className="custom-nav-tabs">
              <Nav.Item>
                <Nav.Link eventKey="all-p2p-data" className="d-flex align-items-center">
                  <i className="bi bi-currency-exchange me-2"></i>
                  All P2P Data
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="price-tracker" className="d-flex align-items-center">
                  <i className="bi bi-graph-up me-2"></i>
                  Theo dõi giá
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="merchant-strategy" className="d-flex align-items-center">
                  <i className="bi bi-gem me-2"></i>
                  Phân tích thị trường
                </Nav.Link>
              </Nav.Item>
            </Nav>
              </Col>
            </Row>

        <Tab.Content>
          <Tab.Pane eventKey="all-p2p-data">
            <AllP2PData />
          </Tab.Pane>
          
          <Tab.Pane eventKey="price-tracker">
            <SpotPriceTracker
              coingeckoSpotPrice={coingeckoSpotPrice}
              spotPriceHistory={spotPriceHistory}
              spotPriceLoading={spotPriceLoading}
            />
          </Tab.Pane>
        
          <Tab.Pane eventKey="merchant-strategy">
            <MerchantStrategyCenter 
              strategy={merchantStrategy} 
              settings={strategySettings} 
              setSettings={setStrategySettings} 
            />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
      
      {/* Rest of the component */}
      </Container>
  );
}

export default App;
