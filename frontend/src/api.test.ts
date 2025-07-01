import { vi } from 'vitest';
import * as api from './api';

describe('api', () => {
  beforeAll(() => {
    global.fetch = vi.fn() as any;
  });

  beforeEach(() => {
    (fetch as any).mockClear();
  });

  it('login throws error if email or password missing', async () => {
    await expect(api.login('', '')).rejects.toThrow();
  });

  it('register throws error if params missing', async () => {
    await expect(api.register('', '', '')).rejects.toThrow();
  });

  it('getScripts throws error if token missing', async () => {
    await expect(api.getScripts('')).rejects.toThrow();
  });

  it('createScript throws error if params missing', async () => {
    await expect(api.createScript('', '')).rejects.toThrow();
    await expect(api.createScript('token', '')).rejects.toThrow();
  });
}); 