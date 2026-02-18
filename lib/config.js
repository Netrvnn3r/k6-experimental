/**
 * Configuration Module
 * Loads environment variables and provides centralized settings.
 * 
 * K6 reads environment variables via __ENV, not process.env.
 * Pass them at runtime: k6 run -e BASE_URL=... -e USERNAME=... script.js
 * Or use a wrapper script that loads .env and forwards them.
 */

export const BASE_URL = __ENV.BASE_URL || 'https://perfappdemo.vercel.app';
export const USERNAME = __ENV.USERNAME || 'ghauyon';
export const PASSWORD = __ENV.PASSWORD || 'user4Test';

/**
 * Default HTTP request timeout (ms)
 */
export const REQUEST_TIMEOUT = '60s';

/**
 * Pagination defaults
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
