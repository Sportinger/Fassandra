/**
 * Feature Flags Configuration
 *
 * This file centralizes all feature flags for the application.
 * Flags are environment-aware: development vs production.
 *
 * Usage:
 *   import { featureFlags } from '@/config/features';
 *   if (featureFlags.debug.showAIFormatModal) { ... }
 */

type Environment = 'development' | 'production';

interface DebugFlags {
  /** Show the AI Format debug modal in the editor toolbar */
  showAIFormatModal: boolean;
  /** Show performance statistics overlay */
  showPerformanceStats: boolean;
  /** Enable verbose console logging */
  verboseLogging: boolean;
  /** Show Yjs sync debug info */
  showYjsDebug: boolean;
}

interface FeatureFlags {
  /** Enable AI-powered document formatting (Claude parsing) */
  aiFormatting: boolean;
  /** Enable experimental editor features */
  experimentalEditor: boolean;
  /** Enable offline mode with service worker */
  offlineMode: boolean;
}

interface Config {
  debug: DebugFlags;
  features: FeatureFlags;
}

const configs: Record<Environment, Config> = {
  development: {
    debug: {
      showAIFormatModal: true,
      showPerformanceStats: false,
      verboseLogging: true,
      showYjsDebug: false,
    },
    features: {
      aiFormatting: true,
      experimentalEditor: false,
      offlineMode: true,
    },
  },
  production: {
    debug: {
      showAIFormatModal: false,
      showPerformanceStats: false,
      verboseLogging: false,
      showYjsDebug: false,
    },
    features: {
      aiFormatting: false,
      experimentalEditor: false,
      offlineMode: true,
    },
  },
};

// Determine environment from Vite env variable, default to production for safety
const envValue = import.meta.env.VITE_ENVIRONMENT as string | undefined;
const environment: Environment =
  envValue === 'development' ? 'development' : 'production';

/**
 * Current environment name
 */
export const currentEnvironment = environment;

/**
 * Feature flags for the current environment
 */
export const featureFlags = configs[environment];

/**
 * Check if we're in development mode
 */
export const isDevelopment = environment === 'development';

/**
 * Check if we're in production mode
 */
export const isProduction = environment === 'production';
