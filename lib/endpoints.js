import http from 'k6/http';
import { BASE_URL } from './config.js';
import { getAuthHeaders } from './auth.js';
import { checkResponse, parseResponse } from './helpers.js';

/**
 * Build a URL query string from an object. K6-compatible (no URLSearchParams).
 * @param {object} params - Key-value pairs
 * @returns {string} Query string (without leading ?)
 */
function buildQueryString(params) {
    const parts = [];
    for (const key in params) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key].toString()));
        }
    }
    return parts.join('&');
}

/**
 * Endpoints Module
 * API wrapper functions for all e-commerce platform endpoints.
 * Each function handles headers, tagging, and basic response validation.
 */

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/products — List products with optional search, pagination, category.
 * @param {string} token - JWT token
 * @param {object} [params] - Query parameters
 * @param {string} [params.search] - Search term
 * @param {number} [params.page] - Page number (1-based)
 * @param {number} [params.pageSize] - Items per page (max 100)
 * @param {string} [params.category] - Category filter
 * @returns {object} Parsed response body
 */
export function getProducts(token, params = {}) {
    const queryStr = buildQueryString(params);
    const url = `${BASE_URL}/api/products${queryStr ? '?' + queryStr : ''}`;

    const res = http.get(url, {
        headers: getAuthHeaders(token),
        tags: { name: 'PRODUCTS_List' },
    });

    checkResponse(res, 200, 'GET Products');
    return parseResponse(res);
}

/**
 * POST /api/products — Create a new product.
 * @param {string} token - JWT token
 * @param {object} product - Product data { sku, name, category, price, stock, description }
 * @returns {object} Parsed response body
 */
export function createProduct(token, product) {
    const url = `${BASE_URL}/api/products`;
    const payload = JSON.stringify(product);

    const res = http.post(url, payload, {
        headers: getAuthHeaders(token),
        tags: { name: 'PRODUCTS_Create' },
    });

    checkResponse(res, 201, 'POST Product');
    return parseResponse(res);
}

/**
 * PATCH /api/products?id=<id> — Update an existing product.
 * @param {string} token - JWT token
 * @param {string} id - Product ID
 * @param {object} updates - Fields to update
 * @returns {object} Parsed response body
 */
export function updateProduct(token, id, updates) {
    const url = `${BASE_URL}/api/products?id=${id}`;
    const payload = JSON.stringify(updates);

    const res = http.patch(url, payload, {
        headers: getAuthHeaders(token),
        tags: { name: 'PRODUCTS_Update' },
    });

    checkResponse(res, 200, 'PATCH Product');
    return parseResponse(res);
}

// ─────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/users — List users with optional search and pagination.
 * @param {string} token - JWT token
 * @param {object} [params] - Query parameters
 * @param {string} [params.search] - Search term (name or email)
 * @param {number} [params.page] - Page number (1-based)
 * @param {number} [params.pageSize] - Items per page (max 100)
 * @returns {object} Parsed response body
 */
export function getUsers(token, params = {}) {
    const queryStr = buildQueryString(params);
    const url = `${BASE_URL}/api/users${queryStr ? '?' + queryStr : ''}`;

    const res = http.get(url, {
        headers: getAuthHeaders(token),
        tags: { name: 'USERS_List' },
    });

    checkResponse(res, 200, 'GET Users');
    return parseResponse(res);
}

/**
 * POST /api/users — Create a new user.
 * @param {string} token - JWT token
 * @param {object} user - User data { name, email }
 * @returns {object} Parsed response body
 */
export function createUser(token, user) {
    const url = `${BASE_URL}/api/users`;
    const payload = JSON.stringify(user);

    const res = http.post(url, payload, {
        headers: getAuthHeaders(token),
        tags: { name: 'USERS_Create' },
    });

    checkResponse(res, 201, 'POST User');
    return parseResponse(res);
}

// ─────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/orders — Create a new order (checkout).
 * This endpoint has a known CPU busy-loop; expect higher latency.
 * @param {string} token - JWT token
 * @param {Array<{sku: string, quantity: number}>} items - Order items
 * @param {string} [userEmail] - Optional customer email
 * @returns {object} HTTP response (raw, for custom metric tracking)
 */
export function createOrder(token, items, userEmail) {
    const url = `${BASE_URL}/api/orders`;
    const payload = JSON.stringify({
        items,
        userEmail: userEmail || 'loadtest@performance.com',
    });

    const res = http.post(url, payload, {
        headers: getAuthHeaders(token),
        tags: { name: 'ORDERS_Create' },
    });

    // Note: 409 is expected when stock is insufficient — not always a failure
    if (res.status !== 409) {
        checkResponse(res, 200, 'POST Order');
    }

    return res;
}

/**
 * GET /api/orders — List orders with optional status filter and pagination.
 * @param {string} token - JWT token
 * @param {object} [params] - Query parameters
 * @param {number} [params.page] - Page number (1-based)
 * @param {number} [params.pageSize] - Items per page (max 100)
 * @param {string} [params.status] - Status filter
 * @returns {object} Parsed response body
 */
export function getOrders(token, params = {}) {
    const queryStr = buildQueryString(params);
    const url = `${BASE_URL}/api/orders${queryStr ? '?' + queryStr : ''}`;

    const res = http.get(url, {
        headers: getAuthHeaders(token),
        tags: { name: 'ORDERS_List' },
    });

    checkResponse(res, 200, 'GET Orders');
    return parseResponse(res);
}
