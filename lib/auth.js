import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, USERNAME, PASSWORD } from './config.js';

/**
 * Authentication Module
 * Handles JWT login, token extraction, header generation, and logout.
 */

/**
 * Authenticates against the API and returns the JWT token.
 * @returns {string} JWT token
 */
export function login() {
    const url = `${BASE_URL}/api/auth`;
    const payload = JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
        tags: { name: 'AUTH_Login' },
    };

    const res = http.post(url, payload, params);

    const success = check(res, {
        'auth: status is 200': (r) => r.status === 200,
        'auth: response has token': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.success === true && body.data && body.data.token;
            } catch (e) {
                return false;
            }
        },
    });

    if (!success) {
        console.error(`Login failed: status=${res.status}, body=${res.body}`);
        return null;
    }

    const body = JSON.parse(res.body);
    return body.data.token;
}

/**
 * Creates the authorization headers object for authenticated requests.
 * @param {string} token - JWT token
 * @returns {object} Headers object with Authorization and Content-Type
 */
export function getAuthHeaders(token) {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Logs out by deleting the auth session (optional cleanup).
 * @param {string} token - JWT token
 */
export function logout(token) {
    const url = `${BASE_URL}/api/auth`;
    const params = {
        headers: getAuthHeaders(token),
        tags: { name: 'AUTH_Logout' },
    };

    const res = http.del(url, null, params);

    check(res, {
        'logout: status is 200': (r) => r.status === 200,
    });
}
