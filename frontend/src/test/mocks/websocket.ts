import { mockWebSocketMessage } from './data';

export class MockWebSocketClient {
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnected: boolean = false;

  connect() {
    this.isConnected = true;
    setTimeout(() => {
      this.trigger('open', {});
    }, 0);
  }

  disconnect() {
    this.isConnected = false;
    setTimeout(() => {
      this.trigger('close', {});
    }, 0);
  }

  send(_data: string) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    // Simulate receiving a response
    setTimeout(() => {
      this.trigger('message', { data: JSON.stringify(mockWebSocketMessage) });
    }, 0);
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }

  private trigger(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
} 