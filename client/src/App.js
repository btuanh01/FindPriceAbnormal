import React from 'react';
import { Container, Badge, Nav, Tab } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import AllP2PData from './components/AllP2PData';
import BuySellComparison from './components/BuySellComparison';

function App() {
  return (
    <Container fluid className="p-4 main-container">
      <header className="mb-4">
        <h1 className="text-center mb-2">
          <i className="bi bi-graph-up-arrow me-2"></i>
          <span className="app-name">Bảng Điều Khiển P2P Binance</span>
        </h1>
        <p className="text-center text-muted">
          Phân tích giá trị giao dịch P2P Binance thị trường Việt Nam 
          <Badge bg="info" className="ms-2">
            Beta
          </Badge>
        </p>
      </header>

      <Tab.Container id="dashboard-tabs" defaultActiveKey="p2p-data">
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="p2p-data">
              <i className="bi bi-table me-2"></i>
              Dữ liệu P2P
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="buy-sell-comparison">
              <i className="bi bi-arrow-left-right me-2"></i>
              So sánh Mua/Bán
            </Nav.Link>
          </Nav.Item>
        </Nav>
        
        <Tab.Content>
          <Tab.Pane eventKey="p2p-data">
            <AllP2PData />
          </Tab.Pane>
          <Tab.Pane eventKey="buy-sell-comparison">
            <BuySellComparison />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </Container>
  );
}

export default App;
