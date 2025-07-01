import { mockUser, mockScripts } from './data';

export const mockApi = {
  login: async (email: string, password: string) => {
    if (email === 'test@example.com' && password === 'password') {
      return mockUser;
    }
    throw new Error('Invalid credentials');
  },

  register: async (email: string, password: string, name: string) => {
    if (email && password && name) {
      return mockUser;
    }
    throw new Error('Missing required fields');
  },

  getScripts: async (token: string) => {
    if (token === mockUser.token) {
      return mockScripts;
    }
    throw new Error('Invalid token');
  },

  createScript: async (token: string, title: string) => {
    if (token === mockUser.token && title) {
      return mockScripts[0];
    }
    throw new Error('Invalid token or missing title');
  },

  updateScript: async (token: string, scriptId: string, content: string) => {
    if (token === mockUser.token && scriptId && content) {
      return { ...mockScripts[0], content };
    }
    throw new Error('Invalid token or missing data');
  }
}; 