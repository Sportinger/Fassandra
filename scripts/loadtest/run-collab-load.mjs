#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import crypto from 'node:crypto';

import got from 'got';
import { CookieJar } from 'tough-cookie';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

// Ensure y-websocket can find a WebSocket implementation when running in Node
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const DEFAULT_CONFIG_PATH = path.resolve('scripts/loadtest/config.json');
const DEFAULT_WORDS = [
  'actor', 'scene', 'cue', 'stage', 'dialogue', 'monologue', 'ensemble', 'light',
  'sound', 'prop', 'script', 'director', 'improv', 'blocking', 'dramatic',
  'choreography', 'rehearsal', 'tempo', 'energy', 'focus', 'intention', 'emotion',
  'gesture', 'movement', 'voice', 'projection', 'timing', 'interaction', 'motivation'
];

function loadConfig() {
  const explicitIndex = process.argv.indexOf('--config');
  let configPath = DEFAULT_CONFIG_PATH;
  if (explicitIndex !== -1 && process.argv[explicitIndex + 1]) {
    configPath = path.resolve(process.argv[explicitIndex + 1]);
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const editsPerMinute = Math.max(1, Number(config.editsPerMinute ?? 20));
  const rawMinThink = config.minThinkTimeMs;
  const rawMaxThink = config.maxThinkTimeMs;
  const averageInterval = Math.max(150, Math.round(60_000 / editsPerMinute));
  let minThinkTimeMs = typeof rawMinThink === 'number' ? rawMinThink : null;
  let maxThinkTimeMs = typeof rawMaxThink === 'number' ? rawMaxThink : null;

  if (minThinkTimeMs === null) {
    minThinkTimeMs = Math.max(100, Math.round(averageInterval * 0.6));
  }
  if (maxThinkTimeMs === null) {
    const fallback = Math.round(averageInterval * 1.4);
    maxThinkTimeMs = Math.max(minThinkTimeMs + 50, fallback);
  }

  return {
    baseUrl: config.baseUrl?.replace(/\/$/, '') ?? 'https://fassandra.de',
    wsUrl: config.wsUrl?.replace(/\/$/, '') ?? null,
    scriptId: config.scriptId,
    virtualUsers: config.virtualUsers ?? 20,
    sessionDurationMs: config.sessionDurationMs ?? 60_000,
    rampUpMs: config.rampUpMs ?? 10_000,
    requestTimeoutMs: config.requestTimeoutMs ?? 15_000,
    editsPerMinute,
    minThinkTimeMs,
    maxThinkTimeMs,
    deleteProbability: config.deleteProbability ?? 0.1,
    rejectUnauthorized: config.rejectUnauthorized ?? true,
    users: Array.isArray(config.users) ? config.users : [],
    wordList: Array.isArray(config.wordList) && config.wordList.length > 0 ? config.wordList : DEFAULT_WORDS,
    bootstrapState: config.bootstrapState ?? true,
    verbose: Boolean(config.verbose ?? false),
  };
}


function validateConfig(config) {
  if (!config.scriptId) {
    throw new Error('`scriptId` is required in the config.');
  }
  if (!config.users.length) {
    throw new Error('`users` array with at least one credential is required.');
  }
  if (config.minThinkTimeMs > config.maxThinkTimeMs) {
    throw new Error('`minThinkTimeMs` cannot be greater than `maxThinkTimeMs`.');
  }
}

function deriveWsUrl(config) {
  if (config.wsUrl) {
    return config.wsUrl;
  }
  const base = config.baseUrl;
  if (base.startsWith('https://')) {
    return base.replace('https://', 'wss://') + '/api/collab';
  }
  if (base.startsWith('http://')) {
    return base.replace('http://', 'ws://') + '/api/collab';
  }
  // Fallback to secure websocket
  return `wss://${base.replace(/^\/*/, '')}/api/collab`;
}

function pickCredential(config, index) {
  return config.users[index % config.users.length];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sampleWord(config) {
  return config.wordList[randomBetween(0, config.wordList.length - 1)];
}

function ensureDocumentShape(doc) {
  const fragment = doc.getXmlFragment('default');
  if (fragment.length === 0) {
    const paragraph = new Y.XmlElement('paragraph');
    const textNode = new Y.XmlText();
    textNode.insert(0, 'Load test bootstrap paragraph. ');
    paragraph.insert(0, [textNode]);
    fragment.insert(0, [paragraph]);
  }
}

function collectTextNodes(fragment) {
  const nodes = [];
  const queue = fragment.toArray();
  while (queue.length) {
    const node = queue.shift();
    if (!node) continue;
    if (node instanceof Y.XmlText) {
      nodes.push(node);
    } else if (node instanceof Y.XmlElement) {
      queue.push(...node.toArray());
    }
  }
  return nodes;
}

async function loginAndFetchWsToken({ clientId, http, baseUrl, scriptId, credential, verbose }) {
  const { email, password } = credential;
  if (!email || !password) {
    throw new Error('Credential entries must include `email` and `password`.');
  }

  if (verbose) {
    console.log(`[client ${clientId}] Logging in as ${email}`);
  }

  await http.post('login', {
    json: { email, password },
  });

  const tokenResponse = await http.get('api/ws-token').json();
  const token = tokenResponse?.token;
  if (!token || typeof token !== 'string') {
    throw new Error('Failed to retrieve WebSocket token.');
  }

  return token;
}

async function bootstrapDocument({ http, scriptId, doc, verbose }) {
  try {
    const buffer = await http.get(`api/scripts/${scriptId}/yjs`, {
      responseType: 'buffer',
    }).buffer();
    if (buffer && buffer.length > 0) {
      Y.applyUpdate(doc, new Uint8Array(buffer));
      if (verbose) {
        console.log(`[bootstrap] Applied binary Yjs state (${buffer.length} bytes)`);
      }
      return true;
    }
  } catch (error) {
    if (verbose) {
      console.warn('[bootstrap] Failed to fetch binary Yjs state:', error.message);
    }
  }
  return false;
}

function waitForSync(provider, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        provider.off('status', onStatus);
        provider.off('sync', onSync);
        reject(new Error('Timed out waiting for WebSocket sync'));
      }
    }, timeoutMs);

    const onStatus = (event) => {
      if (event.status === 'disconnected') {
        // Keep waiting; provider will attempt to reconnect.
      }
    };

    const onSync = (synced) => {
      if (synced && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        provider.off('status', onStatus);
        provider.off('sync', onSync);
        resolve(true);
      }
    };

    provider.on('status', onStatus);
    provider.on('sync', onSync);
  });
}

function registerProviderLogging(provider, clientId, verbose) {
  if (!verbose) return;
  provider.on('status', (event) => {
    console.log(`[client ${clientId}] WS status -> ${event.status}`);
  });
  provider.awareness.on('update', ({ added, updated, removed }) => {
    if (!verbose) return;
    const changed = added.length + updated.length + removed.length;
    if (changed > 0) {
      console.log(`[client ${clientId}] Awareness update (Δ=${changed})`);
    }
  });
}

async function runVirtualClient({
  clientId,
  config,
  credential,
  wsUrl,
  startDelayMs,
  stats,
}) {
  const cookieJar = new CookieJar();
  const http = got.extend({
    prefixUrl: config.baseUrl + '/',
    cookieJar,
    timeout: { request: config.requestTimeoutMs },
    https: { rejectUnauthorized: config.rejectUnauthorized },
    headers: {
      'user-agent': `fassandra-loadtest/${clientId}`,
      'accept': 'application/json',
    },
  });

  let doc;
  let provider;

  try {
    if (startDelayMs > 0) {
      await sleep(startDelayMs);
    }

    const wsToken = await loginAndFetchWsToken({
      clientId,
      http,
      baseUrl: config.baseUrl,
      scriptId: config.scriptId,
      credential,
      verbose: config.verbose,
    });

    doc = new Y.Doc({ guid: `${config.scriptId}-${clientId}-${crypto.randomUUID()}` });
    if (config.bootstrapState) {
      await bootstrapDocument({
        http,
        scriptId: config.scriptId,
        doc,
        verbose: config.verbose,
      });
    }

    ensureDocumentShape(doc);

    provider = new WebsocketProvider(wsUrl, config.scriptId, doc, {
      params: { token: wsToken },
      WebSocketPolyfill: WebSocket,
      disableBc: true,
      connect: true,
      resyncInterval: 10_000,
      maxBackoffTime: 5_000,
    });

    registerProviderLogging(provider, clientId, config.verbose);

    provider.awareness.setLocalStateField('user', {
      name: credential.displayName || credential.email,
      color: '#' + crypto.randomBytes(3).toString('hex'),
    });

    await waitForSync(provider);

    const fragment = doc.getXmlFragment('default');
    let stop = false;
    const stopAt = Date.now() + config.sessionDurationMs;
    const minDelay = config.minThinkTimeMs;
    const maxDelay = config.maxThinkTimeMs;
    const editLabel = `client-${clientId}`;

    while (!stop) {
      const now = Date.now();
      if (now >= stopAt) {
        stop = true;
        break;
      }

      const delay = randomBetween(minDelay, maxDelay);
      await sleep(delay);

      if (!provider.wsconnected) {
        // Skip editing while disconnected; wait briefly before re-checking
        continue;
      }

      const textNodes = collectTextNodes(fragment);
      if (!textNodes.length) {
        ensureDocumentShape(doc);
        continue;
      }

      const target = textNodes[randomBetween(0, textNodes.length - 1)];
      const currentLength = target.length;
      const doDelete = Math.random() < config.deleteProbability && currentLength > 8;

      doc.transact(() => {
        if (doDelete) {
          const deleteLength = Math.min(randomBetween(4, 12), currentLength);
          const deletePos = Math.max(0, randomBetween(0, currentLength - deleteLength));
          target.delete(deletePos, deleteLength);
        } else {
          const insertText = `${sampleWord(config)} ${sampleWord(config)}`;
          const insertPos = randomBetween(0, currentLength);
          target.insert(insertPos, insertText + ' ');
        }
      }, editLabel);

      stats.operations++;
    }
  } catch (error) {
    stats.failures++;
    console.error(`[client ${clientId}] Error:`, error.message);
  } finally {
    if (provider) {
      try {
        provider.destroy();
      } catch (error) {
        if (config.verbose) {
          console.warn(`[client ${clientId}] Failed to destroy provider:`, error.message);
        }
      }
    }
    if (doc) {
      try {
        doc.destroy();
      } catch (error) {
        if (config.verbose) {
          console.warn(`[client ${clientId}] Failed to destroy doc:`, error.message);
        }
      }
    }
  }
}

async function main() {
  const config = loadConfig();
  try {
    validateConfig(config);
  } catch (error) {
    console.error(`Config error: ${error.message}`);
    process.exit(1);
  }

  const wsUrl = deriveWsUrl(config);
  const stats = { operations: 0, failures: 0 };

  console.log(`Starting load with ${config.virtualUsers} virtual users against script ${config.scriptId}`);
  console.log(`HTTP base: ${config.baseUrl} | WS base: ${wsUrl}`);

  const rampStep = config.virtualUsers > 1 ? config.rampUpMs / (config.virtualUsers - 1) : 0;

  const clientPromises = [];
  for (let i = 0; i < config.virtualUsers; i += 1) {
    const credential = pickCredential(config, i);
    const startDelayMs = Math.max(0, Math.floor(rampStep * i));
    clientPromises.push(
      runVirtualClient({
        clientId: i,
        config,
        credential,
        wsUrl,
        startDelayMs,
        stats,
      })
    );
  }

  await Promise.all(clientPromises);

  console.log('Load test complete.');
  console.log(`Total operations: ${stats.operations}`);
  console.log(`Failed clients: ${stats.failures}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
