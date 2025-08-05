#!/usr/bin/env node

const WebSocket = require('ws');

// Test direct WebSocket connection to backend (bypassing nginx)
const directUrl = 'ws://91.99.69.115:3001/api/collab/test-room?token=test-token';
console.log(`Testing direct WebSocket connection to: ${directUrl}`);

const ws = new WebSocket(directUrl);

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully!');
  
  // Send a test Yjs update (small, valid update)
  const testUpdate = Buffer.from([0x00, 0x01, 0x01, 0x00]); // 4 bytes
  console.log(`Sending test update: ${testUpdate.length} bytes`);
  ws.send(testUpdate);
});

ws.on('message', (data) => {
  console.log(`Received message: ${data.length} bytes`);
  console.log(`Data (hex): ${data.toString('hex')}`);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`WebSocket closed. Code: ${code}, Reason: ${reason}`);
});

// Close after 5 seconds
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
}, 5000);