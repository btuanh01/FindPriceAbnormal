import React, { useState, useEffect } from 'react';
import { Card, Table, Spinner, Badge, ButtonGroup, ToggleButton, Tabs, Tab } from 'react-bootstrap';
import { formatVND } from '../utils/formatters';
import './P2PTracker.css';

const P2PTracker = ({ 
  p2pData, 
  p2pLoading,
  tradeType,
  setTradeType
}) => {
  const [priceHistory, setPriceHistory] = useState({
    buy: [],
    sell: []
  });

  // Extract the best price when data is updated
  useEffect(() => {
    if (!p2pLoading && p2pData && p2pData.length > 0) {
      // Sort data by price (lowest for buy, highest for sell)
      const sortedData = [...p2pData].sort((a, b) => {
        if (tradeType === 'BUY') {
          return a.price - b.price; // Lowest price first for buying
        } else {
          return b.price - a.price; // Highest price first for selling
        }
      });

      // Get top price
      const topPrice = sortedData[0]?.price;
      const topSpotPrice = sortedData[0]?.spotPrice;
      const topDeviation = topSpotPrice ? ((topPrice - topSpotPrice) / topSpotPrice * 100).toFixed(2) : '0.00';
      
      if (topPrice) {
        const timestamp = new Date().toISOString();
        const newEntry = {
          price: topPrice,
          deviation: topDeviation,
          timestamp
        };

        if (tradeType === 'BUY') {
          setPriceHistory(prev => ({
            ...prev,
            buy: [...prev.buy, newEntry].slice(-10) // Keep the latest 10 entries
          }));
        } else {
          setPriceHistory(prev => ({
            ...prev,
            sell: [...prev.sell, newEntry].slice(-10) // Keep the latest 10 entries
          }));
        }
      }
    }
  }, [p2pData, p2pLoading, tradeType]);

  const getRowColor = (price, spotPrice) => {
    const deviation = ((price - spotPrice) / spotPrice) * 100;
    if (deviation < -0.5) return 'table-success';
    if (deviation > 0.5) return 'table-danger';
    return '';
  };

  const renderPriceHistoryTable = (historyType) => {
    const historyData = historyType === 'buy' ? priceHistory.buy : priceHistory.sell;
    const title = historyType === 'buy' ? 'Lịch Sử Giá Mua' : 'Lịch Sử Giá Bán';
    
    return (
      <Card className="mb-4 price-history-card">
        <Card.Header>
          <h5 className="mb-0">
            <i className={`bi ${historyType === 'buy' ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle'} me-2`}></i>
            {title}
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
          <Table bordered hover className="price-history-table mb-0">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Giá P2P</th>
                <th>Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {historyData.length > 0 ? (
                historyData.slice().reverse().map((entry, index) => (
                  <tr key={index}>
                    <td>
                      <small className="text-muted">
                        {new Date(entry.timestamp).toLocaleTimeString('vi-VN')}
                      </small>
                    </td>
                    <td className="price-cell">{formatVND(entry.price)}</td>
                    <td>
                      <span className={`deviation-value ${parseFloat(entry.deviation) > 0 ? 'text-danger' : 'text-success'}`}>
                        {parseFloat(entry.deviation) > 0 ? '+' : ''}{entry.deviation}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center py-3">
                    <div className="no-data">
                      <span>Chưa có dữ liệu lịch sử</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    );
  };

  return (
    <div className="p2p-tracker">
      <Card className="mb-4">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h4 className="mb-0">
              <i className="bi bi-currency-exchange me-2"></i>
              Giao Dịch P2P
            </h4>
            <ButtonGroup>
              <ToggleButton
                id="trade-type-buy"
                type="radio"
                variant={tradeType === 'BUY' ? 'primary' : 'outline-primary'}
                name="tradeType"
                value="BUY"
                checked={tradeType === 'BUY'}
                onChange={(e) => setTradeType(e.currentTarget.value)}
              >
                <i className="bi bi-cart me-1"></i> Mua
              </ToggleButton>
              <ToggleButton
                id="trade-type-sell"
                type="radio"
                variant={tradeType === 'SELL' ? 'primary' : 'outline-primary'}
                name="tradeType"
                value="SELL"
                checked={tradeType === 'SELL'}
                onChange={(e) => setTradeType(e.currentTarget.value)}
              >
                <i className="bi bi-cash me-1"></i> Bán
              </ToggleButton>
            </ButtonGroup>
          </div>
        </Card.Header>
        <Card.Body>
          {p2pLoading ? (
            <div className="text-center p-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </Spinner>
            </div>
          ) : (
            <div className="table-responsive">
              <Table bordered hover className="p2p-table">
                <thead>
                  <tr>
                    <th>Người giao dịch</th>
                    <th>Giá</th>
                    <th>Giới hạn</th>
                    <th>Thanh toán</th>
                    <th>Hoàn thành</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {p2pData.map((item, index) => (
                    <tr key={index} className={getRowColor(item.price, item.spotPrice)}>
                      <td>
                        <div className="merchant-info">
                          <span className="merchant-name">{item.merchantName}</span>
                          <Badge bg="secondary" className="ms-2">
                            {item.completionRate}%
                          </Badge>
                        </div>
                      </td>
                      <td className="price-cell">
                        {formatVND(item.price)}
                        {item.spotPrice && (
                          <small className="d-block text-muted">
                            {((item.price - item.spotPrice) / item.spotPrice * 100).toFixed(2)}%
                          </small>
                        )}
                      </td>
                      <td>
                        {formatVND(item.minAmount)} - {formatVND(item.maxAmount)}
                      </td>
                      <td>
                        {item.paymentMethods.map((method, idx) => (
                          <Badge key={idx} bg="info" className="me-1">
                            {method}
                          </Badge>
                        ))}
                      </td>
                      <td>
                        <div className="completion-info">
                          <span>{item.completedOrders}</span>
                          <small className="text-muted">/ {item.totalOrders}</small>
                        </div>
                      </td>
                      <td>
                        <small className="text-muted">
                          {new Date(item.timestamp).toLocaleTimeString('vi-VN')}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Price History Panel */}
      <div className="price-history-container">
        <h4 className="mb-3">
          <i className="bi bi-clock-history me-2"></i>
          Giá Hàng Đầu
        </h4>
        
        <Tabs defaultActiveKey="buyHistory" className="mb-3 history-tabs">
          <Tab eventKey="buyHistory" title="Cơ Hội Mua">
            {renderPriceHistoryTable('buy')}
          </Tab>
          <Tab eventKey="sellHistory" title="Cơ Hội Bán">
            {renderPriceHistoryTable('sell')}
          </Tab>
        </Tabs>
        
        <div className="text-muted mt-2">
          <small>
            <i className="bi bi-info-circle me-1"></i>
            Hiển thị giá tốt nhất trong 10 lần cập nhật gần nhất
          </small>
        </div>
      </div>
    </div>
  );
};

export default P2PTracker; 