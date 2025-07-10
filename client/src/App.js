import React from 'react';
import { Container, Badge } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import AllP2PData from './components/AllP2PData';

function App() {
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

      <AllP2PData />
      
    </Container>
  );
}

export default App;
