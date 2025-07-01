export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  token: 'mock-jwt-token'
};

export const mockScripts = [
  {
    id: 'script-1',
    title: 'Test Script 1',
    content: 'Test content 1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'script-2',
    title: 'Test Script 2',
    content: 'Test content 2',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }
];

export const mockWebSocketMessage = {
  type: 'update',
  data: {
    scriptId: 'script-1',
    content: 'Updated content',
    cursor: { x: 0, y: 0 }
  }
}; 