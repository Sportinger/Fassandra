import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { mockApi } from './mocks/api';
import { MockWebSocketClient } from './mocks/websocket';

// Mock fetch globally
global.fetch = vi.fn();

// Mock API functions
vi.mock('../api', () => ({
  login: mockApi.login,
  register: mockApi.register,
  getScripts: mockApi.getScripts,
  createScript: mockApi.createScript,
  updateScript: mockApi.updateScript,
}));

// Mock WebSocket
global.WebSocket = MockWebSocketClient as any;

// Set environment variables
process.env.VITE_API_BASE_URL = 'http://localhost:3000';
process.env.VITE_WS_URL = 'ws://localhost:3000/ws'; 