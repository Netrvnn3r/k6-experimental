import { check } from 'k6';

/**
 * Helpers Module
 * Shared utility functions for data generation, random selection, and assertions.
 */

/**
 * Returns a random element from an array.
 * @param {Array} arr - Source array
 * @returns {*} Random element
 */
export function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random email address for user creation.
 * @returns {string}
 */
export function generateEmail() {
    const id = Math.random().toString(36).substring(2, 10);
    return `perf_user_${id}@loadtest.com`;
}

/**
 * Generates a random user name.
 * @returns {string}
 */
export function generateUserName() {
    const id = Math.random().toString(36).substring(2, 10);
    return `LoadTest User ${id}`;
}

/**
 * Generates a random SKU string.
 * @returns {string}
 */
export function generateSku() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let sku = '';
    for (let i = 0; i < 10; i++) {
        sku += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return sku;
}

/**
 * Generates a random product name.
 * @returns {string}
 */
export function generateProductName() {
    const adjectives = ['Premium', 'Ultra', 'Pro', 'Mega', 'Super', 'Elite', 'Max', 'Turbo'];
    const nouns = ['Widget', 'Gadget', 'Device', 'Tool', 'Kit', 'Pack', 'Set', 'Unit'];
    return `${randomItem(adjectives)} ${randomItem(nouns)} ${randomInt(1000, 9999)}`;
}

/**
 * Validates a response against expected status and logs on failure.
 * @param {object} res - K6 HTTP response
 * @param {number} expectedStatus - Expected HTTP status code
 * @param {string} label - Check label for identification
 * @returns {boolean} True if all checks pass
 */
export function checkResponse(res, expectedStatus, label) {
    const result = check(res, {
        [`${label}: status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
        [`${label}: response is success`]: (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.success === true;
            } catch (e) {
                return false;
            }
        },
    });

    if (!result) {
        console.warn(`[${label}] Unexpected response: status=${res.status}, body=${res.body.substring(0, 200)}`);
    }

    return result;
}

/**
 * Parses a JSON response body safely.
 * @param {object} res - K6 HTTP response
 * @returns {object|null} Parsed body or null
 */
export function parseResponse(res) {
    try {
        return JSON.parse(res.body);
    } catch (e) {
        console.error(`Failed to parse response: ${res.body.substring(0, 200)}`);
        return null;
    }
}

/**
 * Sleeps for a random duration between min and max seconds (think time).
 * K6 sleep must be imported separately — this returns the value to pass to sleep().
 * @param {number} min - Minimum seconds
 * @param {number} max - Maximum seconds
 * @returns {number} Random duration in seconds
 */
export function randomThinkTime(min = 1, max = 3) {
    return Math.random() * (max - min) + min;
}

/**
 * Genera un timestamp para nombres de archivo de reportes.
 * Formato: YYYYMMDD-HHmmss (ej: 20260218-224500)
 * Esto asegura que cada ejecución crea un reporte nuevo sin sobreescribir los anteriores.
 * @returns {string} Timestamp formateado
 */
export function getTimestamp() {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}${mo}${d}-${h}${mi}${s}`;
}
