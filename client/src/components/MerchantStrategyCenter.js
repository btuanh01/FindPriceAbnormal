import React from 'react';
import { Card, Badge, ProgressBar, ButtonGroup, ToggleButton, Spinner } from 'react-bootstrap';
import { formatVND } from '../utils/formatters';
import './MerchantStrategyCenter.css';

const MerchantStrategyCenter = ({
  strategy,
  settings,
  setSettings,
  loading
}) => {
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
          <div className="mb-3">
            <div className="strategy-label">Mức độ rủi ro chấp nhận</div>
            <ButtonGroup className="w-100">
              <ToggleButton
                id="risk-safe"
                type="radio"
                variant={settings.riskAppetite === "safe" ? "primary" : "outline-primary"}
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
                variant={settings.riskAppetite === "balanced" ? "primary" : "outline-primary"}
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
                variant={settings.riskAppetite === "aggressive" ? "primary" : "outline-primary"}
                name="risk"
                value="aggressive"
                checked={settings.riskAppetite === "aggressive"}
                onChange={(e) => setSettings({...settings, riskAppetite: e.currentTarget.value})}
              >
                <i className="bi bi-lightning-fill me-1"></i> Tích cực
              </ToggleButton>
            </ButtonGroup>
          </div>
          
          <div className="mb-0">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="autoAlertSwitch"
                checked={settings.autoAlert}
                onChange={(e) => setSettings({...settings, autoAlert: e.target.checked})}
              />
              <label className="form-check-label" htmlFor="autoAlertSwitch">
                Tự động thông báo khi có thời điểm tốt
              </label>
            </div>
          </div>
        </Card.Body>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Đang tải...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="merchant-strategy-container">
      {renderRecommendationBox()}
      
      <div className="row">
        <div className="col-lg-8">
          <div className="row">
            <div className="col-md-6">
              {renderBtcTrendCard()}
            </div>
            <div className="col-md-6">
              {renderSpreadCard()}
            </div>
          </div>
          <div className="row">
            <div className="col-md-4">
              {renderTimeSessionCard()}
            </div>
            <div className="col-md-8">
              {renderCompetitionCard()}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          {renderLiquidityCard()}
          {renderSettings()}
          
          <Card className="last-updated-card">
            <Card.Body className="py-2">
              <small className="text-muted">
                <i className="bi bi-clock-history me-1"></i>
                Cập nhật lần cuối: {strategy.lastUpdated ? new Date(strategy.lastUpdated).toLocaleTimeString('vi-VN') : 'Chưa cập nhật'}
              </small>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MerchantStrategyCenter; 