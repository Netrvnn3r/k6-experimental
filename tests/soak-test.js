import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { SOAK_OPTIONS } from '../config/options.js';
import { login } from '../lib/auth.js';
import { getProducts, getUsers, createOrder, getOrders } from '../lib/endpoints.js';
import { randomItem, randomInt, randomThinkTime, getTimestamp } from '../lib/helpers.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────
const SEARCH_TERMS = JSON.parse(open('../data/search-terms.json'));
const CATEGORIES = JSON.parse(open('../data/categories.json'));

// ─────────────────────────────────────────────────────────────
// CUSTOM METRICS — Track degradation over time
// ─────────────────────────────────────────────────────────────
const checkoutDuration = new Trend('checkout_duration', true);
const checkoutErrors = new Rate('checkout_error_rate');
const iterationDuration = new Trend('iteration_duration', true);
const orderConflicts = new Counter('order_stock_conflicts');

// ─────────────────────────────────────────────────────────────
// OPTIONS — Soak Test
// 15 VUs sustained for 15 minutes
// ─────────────────────────────────────────────────────────────
export const options = {
    ...SOAK_OPTIONS,
    thresholds: {
        ...SOAK_OPTIONS.thresholds,
        'checkout_duration': ['p(95)<3000'],
        'checkout_error_rate': ['rate<0.10'],
        'iteration_duration': ['p(95)<15000'],
    },
};

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
export function setup() {
    const token = login();
    if (!token) throw new Error('Authentication failed. Cannot run soak test.');

    const productsData = getProducts(token, { page: 1, pageSize: 50 });
    const skus = [];
    if (productsData && productsData.data && productsData.data.items) {
        productsData.data.items.forEach((p) => {
            if (p.stock > 0) skus.push(p.sku);
        });
    }

    console.log(`🏊 Soak Test Setup: ${skus.length} SKUs, sustained 15 minute run`);
    return { token, skus };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FUNCTION — Sustained realistic workload
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token, skus } = data;
    const iterStart = Date.now();

    const journey = Math.random();

    if (journey < 0.45) {
        soakBrowseProducts(token);
    } else if (journey < 0.70) {
        soakCheckout(token, skus);
    } else if (journey < 0.85) {
        soakBrowseUsers(token);
    } else {
        soakViewOrders(token);
    }

    iterationDuration.add(Date.now() - iterStart);
}

function soakBrowseProducts(token) {
    getProducts(token, { search: randomItem(SEARCH_TERMS), page: 1, pageSize: 20 });
    sleep(randomThinkTime(1, 3));

    getProducts(token, { page: randomInt(1, 50), pageSize: 20 });
    sleep(randomThinkTime(1, 2));

    getProducts(token, { category: randomItem(CATEGORIES), page: 1, pageSize: 20 });
    sleep(randomThinkTime(1, 3));
}

function soakCheckout(token, skus) {
    const productsData = getProducts(token, { page: randomInt(1, 5), pageSize: 10 });
    sleep(randomThinkTime(1, 2));

    let sku;
    if (productsData && productsData.data && productsData.data.items && productsData.data.items.length > 0) {
        sku = randomItem(productsData.data.items).sku;
    } else if (skus.length > 0) {
        sku = randomItem(skus);
    } else return;

    const start = Date.now();
    const orderRes = createOrder(token, [{ sku, quantity: 1 }], 'soak@loadtest.com');
    checkoutDuration.add(Date.now() - start);

    if (orderRes.status === 409) {
        orderConflicts.add(1);
        checkoutErrors.add(0);
    } else if (orderRes.status === 200) {
        checkoutErrors.add(0);
    } else {
        checkoutErrors.add(1);
    }

    sleep(randomThinkTime(2, 4));
}

function soakBrowseUsers(token) {
    getUsers(token, { page: randomInt(1, 20), pageSize: 20 });
    sleep(randomThinkTime(1, 3));
}

function soakViewOrders(token) {
    getOrders(token, { page: 1, pageSize: 20 });
    sleep(randomThinkTime(1, 3));
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN & REPORT
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('🏊 Soak Test Complete — check for latency degradation over time.');
}

export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/soak-test_${ts}.html`]: htmlReport(data),
        [`reports/soak-test_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
