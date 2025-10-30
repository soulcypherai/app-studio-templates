import { SoulCypherSDK } from '@soulcypher/twin-sdk';

/**
 * SoulCypher Platform SDK Client Singleton
 *
 * Initializes the SoulCypher SDK with your platform API key.
 * The SDK provides access to conversational AI, voice, and video avatar capabilities.
 *
 * @see https://docs.soulcypher.ai for full documentation
 */

let sdk: SoulCypherSDK | null = null;

export function getPlatformSDK(): SoulCypherSDK {
  if (!sdk) {
    const apiKey = import.meta.env.VITE_PLATFORM_API_KEY;

    if (!apiKey || apiKey === 'sk_xxxxx') {
      throw new Error(
        'SoulCypher Platform API key not configured. Set VITE_PLATFORM_API_KEY in your .env.local file. ' +
        'Get your API key from https://dev.soulcypher.ai'
      );
    }

    sdk = new SoulCypherSDK({
      apiKey,
      baseUrl: import.meta.env.VITE_PLATFORM_API_URL || 'https://api.soulcypher.ai',
    });
  }

  return sdk;
}

/**
 * Check if SoulCypher Platform SDK is properly configured
 */
export function isPlatformSDKConfigured(): boolean {
  const apiKey = import.meta.env.VITE_PLATFORM_API_KEY;
  return !!apiKey && apiKey !== 'sk_xxxxx';
}
