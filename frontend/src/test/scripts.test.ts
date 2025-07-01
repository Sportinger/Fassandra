import { describe, it, expect, beforeAll } from 'vitest';
import { getScripts, createScript, updateScript, register, login } from '../api';

describe('Script Management', () => {
  let token: string;
  let scriptId: string;
  const unique = Date.now();
  const email = `scriptuser_${unique}@example.com`;
  const username = `scriptuser_${unique}`;

  beforeAll(async () => {
    // Register and login a user to get a valid token
    await register(email, username, 'password');
    token = await login(email, 'password');
  });

  it('should fetch scripts successfully with valid token', async () => {
    const result = await getScripts(token);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should fail to fetch scripts with invalid token', async () => {
    await expect(getScripts('invalid-token')).rejects.toThrow(/Invalid token|401/);
  });

  it('should create a new script successfully', async () => {
    const script = await createScript(token, 'New Script');
    scriptId = script.id;
    expect(typeof scriptId).toBe('string');
    expect(scriptId.length).toBeGreaterThan(10);
    expect(script.title).toBe('New Script');
  });

  it('should fail to create script with invalid token', async () => {
    await expect(createScript('invalid-token', 'New Script')).rejects.toThrow(/Invalid token|401/);
  });

  it('should update script successfully', async () => {
    // Ensure a script exists
    if (!scriptId) {
      const script = await createScript(token, 'Script to Update');
      scriptId = script.id;
    }
    const updated = await updateScript(token, scriptId, 'Updated Title');
    expect(updated.title).toBe('Updated Title');
  });

  it('should fail to update script with invalid token', async () => {
    await expect(updateScript('invalid-token', scriptId || 'fake-id', 'Updated Title')).rejects.toThrow(/Invalid token|401/);
  });
}); 