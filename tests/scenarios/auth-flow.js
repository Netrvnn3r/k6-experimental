import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { login, logout, getAuthHeaders } from '../../lib/auth.js';
import { BASE_URL } from '../../lib/config.js';
import { checkResponse, getTimestamp } from '../../lib/helpers.js';
import http from 'k6/http';
import { check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────
const loginDuration = new Trend('login_duration', true);
const logoutDuration = new Trend('logout_duration', true);
const tokenValidationDuration = new Trend('token_validation_duration', true);
const authFailures = new Rate('auth_failure_rate');
const loginCycles = new Counter('login_cycles');

// ─────────────────────────────────────────────────────────────
// OPTIONS — Auth Flow Scenario
// ─────────────────────────────────────────────────────────────
export const options = {
    scenarios: {
        auth_login_logout: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 10 },
                { duration: '1m', target: 10 },
                { duration: '30s', target: 20 },
                { duration: '1m', target: 20 },
                { duration: '30s', target: 0 },
            ],
        },
    },
    thresholds: {
        'login_duration': ['p(95)<2000', 'p(99)<3000'],
        'logout_duration': ['p(95)<1000'],
        'token_validation_duration': ['p(95)<1500'],
        'auth_failure_rate': ['rate<0.05'],
        'http_req_failed': ['rate<0.05'],
    },
};

// ─────────────────────────────────────────────────────────────
// DEFAULT — Login → validate token → use token → logout cycle
// ─────────────────────────────────────────────────────────────
export default function () {
    // Step 1: Login
    const loginStart = Date.now();
    const url = `${BASE_URL}/api/auth`;
    const payload = JSON.stringify({
        username: __ENV.USERNAME || 'ghauyon',
        password: __ENV.PASSWORD || 'user4Test',
    });

    const loginRes = http.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'AUTH_Login' },
    });

    loginDuration.add(Date.now() - loginStart);

    const loginSuccess = check(loginRes, {
        'login: status 200': (r) => r.status === 200,
        'login: has token': (r) => {
            try {
                return JSON.parse(r.body).data.token !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    if (!loginSuccess) {
        authFailures.add(1);
        return;
    }
    authFailures.add(0);
    loginCycles.add(1);

    const token = JSON.parse(loginRes.body).data.token;
    sleep(1);

    // Step 2: Validate token by making an authenticated request
    const valStart = Date.now();
    const valRes = http.get(`${BASE_URL}/api/products?page=1&pageSize=1`, {
        headers: getAuthHeaders(token),
        tags: { name: 'AUTH_TokenValidation' },
    });
    tokenValidationDuration.add(Date.now() - valStart);

    check(valRes, {
        'token validation: status 200': (r) => r.status === 200,
        'token validation: data returned': (r) => {
            try {
                return JSON.parse(r.body).success === true;
            } catch (e) {
                return false;
            }
        },
    });
    sleep(1);

    // Step 3: Logout
    const logoutStart = Date.now();
    const logoutRes = http.del(url, null, {
        headers: getAuthHeaders(token),
        tags: { name: 'AUTH_Logout' },
    });
    logoutDuration.add(Date.now() - logoutStart);

    check(logoutRes, {
        'logout: status 200': (r) => r.status === 200,
    });

    sleep(2);
}

// ─────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────
export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/auth-flow_${ts}.html`]: htmlReport(data),
        [`reports/auth-flow_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
