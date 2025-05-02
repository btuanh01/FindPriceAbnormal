import React from 'react';
import { Card, Table, Spinner } from 'react-bootstrap';
import { formatVND } from '../utils/formatters';

const SpotPriceTracker = ({ 
  coingeckoSpotPrice, 
  spotPriceHistory, 
  spotPriceLoading 
}) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getPriceChange = () => {
    if (spotPriceHistory.length < 2) return 0;
    const firstPrice = spotPriceHistory[0].price;
    const lastPrice = spotPriceHistory[spotPriceHistory.length - 1].price;
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  };

  const priceChange = getPriceChange();
  const isPriceUp = priceChange > 0;

  return (
    <div className="spot-price-tracker">
      <Card className="mb-4">
        <Card.Header>
          <h4 className="mb-0">
            <i className="bi bi-graph-up me-2"></i>
            Theo dõi Giá USDT
          </h4>
        </Card.Header>
        <Card.Body>
          {spotPriceLoading ? (
            <div className="text-center p-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </Spinner>
            </div>
          ) : (
            <>
              <div className="current-price mb-4">
                <div className="d-flex align-items-center justify-content-between">
                  <h2 className="text-primary mb-0">
                    {formatVND(coingeckoSpotPrice)}
                  </h2>
                  <div className={`price-change ${isPriceUp ? 'text-success' : 'text-danger'}`}>
                    <i className={`bi bi-arrow-${isPriceUp ? 'up' : 'down'}-circle-fill me-1`}></i>
                    {Math.abs(priceChange).toFixed(2)}%
                  </div>
                </div>
                <small className="text-muted">
                  Cập nhật lần cuối: {formatTime(spotPriceHistory[spotPriceHistory.length - 1]?.timestamp)}
                </small>
              </div>

              {/* GeckoTerminal Chart */}
              <div className="gecko-terminal-chart mb-4">
                <h5 className="mb-3">Biểu đồ giá USDT</h5>
                <div className="chart-container" style={{ height: '800px' }}>
                  <iframe
                    src="https://www.geckoterminal.com/vi/eth/pools/0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7?utm_campaign=livechart-btn&utm_medium=referral&utm_source=coingecko&token_address=0xdac17f958d2ee523a2206206994597c13d831ec7"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    title="USDT Price Chart"
                    style={{ 
                      border: 'none',
                      minHeight: '800px'
                    }}
                  ></iframe>
                </div>
              </div>
              
              <div className="price-history">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Lịch sử giá 24h</h5>
                  <small className="text-muted">
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Tự động cập nhật mỗi phút
                  </small>
                </div>
                <div className="table-responsive">
                  <Table bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Giá (VND)</th>
                        <th>Thay đổi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spotPriceHistory.map((item, index) => {
                        const prevPrice = index > 0 ? spotPriceHistory[index - 1].price : item.price;
                        const change = ((item.price - prevPrice) / prevPrice) * 100;
                        const isUp = change > 0;
                        
                        return (
                          <tr key={index}>
                            <td>{formatTime(item.timestamp)}</td>
                            <td>{formatVND(item.price)}</td>
                            <td className={isUp ? 'text-success' : 'text-danger'}>
                              {change !== 0 && (
                                <>
                                  <i className={`bi bi-arrow-${isUp ? 'up' : 'down'}-circle-fill me-1`}></i>
                                  {Math.abs(change).toFixed(2)}%
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default SpotPriceTracker; 