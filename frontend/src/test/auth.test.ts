import { describe, it, expect, vi } from 'vitest';
import { login, register } from '../api';
import { mockUser } from './mocks/data';

describe('Authentication', () => {
  it('should register successfully with valid data', async () => {
    const unique = Date.now();
    const email = `newuser_${unique}@example.com`;
    const username = `newuser_${unique}`;
    const token = await register(email, username, 'password');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10); // JWTs are long strings
  });

  it('should login successfully with valid credentials', async () => {
    // Register first to ensure user exists
    const unique = Date.now();
    const email = `loginuser_${unique}@example.com`;
    const username = `loginuser_${unique}`;
    await register(email, username, 'password');
    const token = await login(email, 'password');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });

  it('should fail login with invalid credentials', async () => {
    await expect(login('wrong@example.com', 'wrong')).rejects.toThrow(/Invalid credentials|401/);
  });

  it('should fail registration with missing fields', async () => {
    await expect(register('', '', '')).rejects.toThrow(/Missing required fields|required/);
  });
}); 