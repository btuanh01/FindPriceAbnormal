import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Table, Spinner, Row, Col } from 'react-bootstrap';

const BuySellComparison = () => {
  const [data, setData] = useState({ buy: [], sell: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/p2p/buy-sell-top50');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setData(result);
      setLastUpdated(new Date().toLocaleString('vi-VN'));
    } catch (err) {
      console.error('Error fetching buy/sell data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    fetchData();
  };

  const getBinanceP2PUrl = (item) => {
    return `https://p2p.binance.com/en/advertiserDetail?advertiserNo=${item.advertiser.userNo}`;
  };

  const renderTable = (dataArray, title, type) => {
    const bgColor = type === 'buy' ? 'success' : 'danger';
    const textColor = type === 'buy' ? 'text-success' : 'text-danger';
    
    return (
      <Card className="mb-4">
        <Card.Header className={`bg-${bgColor} text-white`}>
          <h5 className="mb-0">
            <i className={`bi bi-${type === 'buy' ? 'arrow-down' : 'arrow-up'}-circle me-2`}></i>
            {title}
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
          <Table striped hover responsive className="mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '15%' }}>Giá</th>
                <th style={{ width: '15%' }}>Giới hạn</th>
                <th style={{ width: '15%' }}>Khả dụng</th>
                <th style={{ width: '20%' }}>Người bán</th>
                <th style={{ width: '15%' }}>Tỷ lệ hoàn thành</th>
                <th style={{ width: '15%' }}>Phương thức</th>
              </tr>
            </thead>
            <tbody>
              {dataArray.map((item, index) => (
                <tr key={item.adv.advNo}>
                  <td>
                    <Badge bg="secondary">{index + 1}</Badge>
                  </td>
                  <td>
                    <strong className={textColor}>
                      {formatVND(parseFloat(item.adv.price))}
                    </strong>
                  </td>
                  <td>
                    <small className="text-muted">
                      {formatVND(parseFloat(item.adv.minSingleTransAmount))} - {formatVND(parseFloat(item.adv.maxSingleTransAmount))}
                    </small>
                  </td>
                  <td>
                    <Badge bg="info">
                      {parseFloat(item.adv.tradableQuantity).toFixed(2)} USDT
                    </Badge>
                  </td>
                  <td>
                    <div>
                      <a 
                        href={getBinanceP2PUrl(item)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-decoration-none"
                      >
                        <strong>{item.advertiser.nickName}</strong>
                      </a>
                      <br />
                      <small className="text-muted">
                        {item.advertiser.monthOrderCount} giao dịch/tháng
                      </small>
                    </div>
                  </td>
                  <td>
                    <Badge 
                      bg={item.advertiser.monthFinishRate >= 0.98 ? 'success' : 
                          item.advertiser.monthFinishRate >= 0.95 ? 'warning' : 'danger'}
                    >
                      {(item.advertiser.monthFinishRate * 100).toFixed(1)}%
                    </Badge>
                  </td>
                  <td>
                    <div>
                      {item.adv.tradeMethods.map((method, idx) => (
                        <Badge key={idx} bg="outline-primary" className="me-1 mb-1">
                          {method.tradeMethodName}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Đang tải...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-danger">
        <Card.Body>
          <h5 className="text-danger">
            <i className="bi bi-exclamation-triangle me-2"></i>
            Lỗi khi tải dữ liệu
          </h5>
          <p className="text-muted">{error}</p>
          <Button variant="outline-danger" onClick={handleRefresh}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Thử lại
          </Button>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div>
      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-center">
            <Col md={8}>
              <h4 className="mb-2">
                <i className="bi bi-arrow-left-right me-2"></i>
                So sánh giá mua/bán USDT
              </h4>
                             <p className="text-muted mb-0">
                 Top 20 giá mua thấp nhất và top 20 giá bán cao nhất cho thị trường Việt Nam
               </p>
            </Col>
            <Col md={4} className="text-end">
              <Button variant="outline-primary" onClick={handleRefresh} disabled={loading}>
                <i className="bi bi-arrow-clockwise me-2"></i>
                Làm mới
              </Button>
            </Col>
          </Row>
          
          {lastUpdated && (
            <Row className="mt-3">
              <Col>
                <small className="text-muted">
                  <i className="bi bi-clock me-1"></i>
                  Cập nhật lần cuối: {lastUpdated}
                </small>
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>

      <Row>
        <Col lg={6}>
          {renderTable(data.buy, 'Top 20 Giá Mua Thấp Nhất', 'buy')}
        </Col>
        <Col lg={6}>
          {renderTable(data.sell, 'Top 20 Giá Bán Cao Nhất', 'sell')}
        </Col>
      </Row>

      {data.metadata && (
        <Card className="mb-4">
          <Card.Body>
            <h6>Thông tin dữ liệu</h6>
            <Row>
              <Col md={6}>
                <small className="text-muted">
                  <strong>Tổng số mua:</strong> {data.metadata.recordCounts?.buy || 0} giao dịch<br />
                  <strong>Tổng số bán:</strong> {data.metadata.recordCounts?.sell || 0} giao dịch<br />
                  <strong>Quốc gia:</strong> {data.metadata.countries?.join(', ') || 'VN'}
                </small>
              </Col>
              <Col md={6}>
                <small className="text-muted">
                  <strong>Phương thức thanh toán:</strong> {data.metadata.payTypes?.join(', ') || 'Bank, BankTransferVietnam'}<br />
                  <strong>Thời gian phản hồi:</strong> {data.metadata.executionTime}<br />
                  <strong>Timestamp:</strong> {data.timestamp}
                </small>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default BuySellComparison; 