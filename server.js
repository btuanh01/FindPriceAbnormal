const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - ensure CORS is configured correctly for client requests
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io with correct CORS settings
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize configuration
let config = {
  deviationThreshold: 0.5,
  isFilterEnabled: true,
  updateInterval: 60000
};

// Initialize anomalies array
let anomalies = [];

// Update config endpoint
app.put('/api/config', (req, res) => {
  const newConfig = req.body;
  // Store the new config including isFilterEnabled
  config = {
    ...config,
    ...newConfig,
    isFilterEnabled: newConfig.isFilterEnabled !== undefined ? newConfig.isFilterEnabled : true
  };
  res.json({ success: true, config });
});

// Update anomalies endpoint
app.get('/api/anomalies', (req, res) => {
  const filterEnabled = req.query.filterEnabled === 'true';
  
  if (filterEnabled) {
    // Return filtered data based on threshold
    const threshold = config.deviationThreshold || 0.5;
    const filteredAnomalies = anomalies.filter(anomaly => 
      Math.abs(anomaly.deviation) >= threshold
    );
    res.json({ anomalies: filteredAnomalies, timestamp: new Date().toISOString() });
  } else {
    // Return all data (limited to 200)
    res.json({ 
      anomalies: anomalies.slice(0, 200), 
      timestamp: new Date().toISOString() 
    });
  }
});

// Update socket.io handling
io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Send initial data
  const initialData = {
    anomalies: config.isFilterEnabled 
      ? anomalies.filter(a => Math.abs(a.deviation) >= config.deviationThreshold)
      : anomalies.slice(0, 200),
    config: config
  };
  socket.emit('anomalies', initialData);
  
  // Handle client requests for anomalies
  socket.on('request_anomalies', (clientConfig) => {
    const filteredAnomalies = clientConfig?.isFilterEnabled
      ? anomalies.filter(a => Math.abs(a.deviation) >= clientConfig.deviationThreshold)
      : anomalies.slice(0, 200);
    socket.emit('anomalies', filteredAnomalies);
  });
  
  // Handle new anomaly data
  socket.on('new_anomaly', (anomaly) => {
    anomalies.push(anomaly);
    if (anomalies.length > 200) {
      anomalies.shift();
    }
    
    // Emit to all clients
    io.emit('anomalies', {
      anomalies: anomalies.slice(0, 200),
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 