import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { STRESS_OPTIONS } from '../config/options.js';
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
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────
const checkoutDuration = new Trend('checkout_duration', true);
const checkoutErrors = new Rate('checkout_error_rate');
const orderConflicts = new Counter('order_stock_conflicts');
const highPageDuration = new Trend('high_page_duration', true);

// ─────────────────────────────────────────────────────────────
// OPTIONS — Stress Test
// Progressive ramp: 0→20→50→100→150 VUs
// ─────────────────────────────────────────────────────────────
export const options = {
    ...STRESS_OPTIONS,
    thresholds: {
        ...STRESS_OPTIONS.thresholds,
        'checkout_duration': ['p(95)<5000'],
        'checkout_error_rate': ['rate<0.30'],
        'high_page_duration': ['p(95)<5000'],
    },
};

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
export function setup() {
    const token = login();
    if (!token) throw new Error('Authentication failed. Cannot run stress test.');

    const productsData = getProducts(token, { page: 1, pageSize: 50 });
    const skus = [];
    if (productsData && productsData.data && productsData.data.items) {
        productsData.data.items.forEach((p) => {
            if (p.stock > 0) skus.push(p.sku);
        });
    }

    console.log(`🔥 Stress Test Setup: ${skus.length} SKUs loaded`);
    return { token, skus };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FUNCTION — Heavy mixed workload
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token, skus } = data;
    const journey = Math.random();

    if (journey < 0.35) {
        // 35% — Product browsing with deep pagination (stress)
        stressProductBrowse(token);
    } else if (journey < 0.60) {
        // 25% — Concurrent checkout attempts
        stressCheckout(token, skus);
    } else if (journey < 0.80) {
        // 20% — User list with large page sizes
        stressUserBrowse(token);
    } else {
        // 20% — Order listing
        stressOrderView(token);
    }
}

function stressProductBrowse(token) {
    // Normal search
    getProducts(token, { search: randomItem(SEARCH_TERMS), page: 1, pageSize: 50 });
    sleep(randomThinkTime(0.5, 1));

    // Deep pagination — known to add cost
    const deepPage = randomInt(50, 200);
    const start = Date.now();
    getProducts(token, { page: deepPage, pageSize: 100 });
    highPageDuration.add(Date.now() - start);
    sleep(randomThinkTime(0.5, 1));

    // Category filter with max page size
    getProducts(token, { category: randomItem(CATEGORIES), page: 1, pageSize: 100 });
    sleep(randomThinkTime(0.3, 0.8));
}

function stressCheckout(token, skus) {
    // Quick browse → checkout
    const productsData = getProducts(token, { page: randomInt(1, 10), pageSize: 10 });
    sleep(randomThinkTime(0.3, 0.8));

    let sku;
    if (productsData && productsData.data && productsData.data.items && productsData.data.items.length > 0) {
        sku = randomItem(productsData.data.items).sku;
    } else if (skus.length > 0) {
        sku = randomItem(skus);
    } else return;

    // Create order with multiple items to stress CPU loop
    const quantity = randomInt(1, 3);
    const start = Date.now();
    const orderRes = createOrder(token, [{ sku, quantity }], 'stress@loadtest.com');
    checkoutDuration.add(Date.now() - start);

    if (orderRes.status === 409) {
        orderConflicts.add(1);
        checkoutErrors.add(0);
    } else if (orderRes.status === 200) {
        checkoutErrors.add(0);
    } else {
        checkoutErrors.add(1);
    }

    sleep(randomThinkTime(0.3, 0.8));
}

function stressUserBrowse(token) {
    // Large page with deep pagination
    getUsers(token, { page: randomInt(1, 100), pageSize: 100 });
    sleep(randomThinkTime(0.3, 0.8));

    getUsers(token, { search: 'Performance', page: randomInt(1, 50), pageSize: 50 });
    sleep(randomThinkTime(0.3, 0.8));
}

function stressOrderView(token) {
    getOrders(token, { page: 1, pageSize: 100 });
    sleep(randomThinkTime(0.3, 0.8));
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN & REPORT
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('🔥 Stress Test Complete.');
}

export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/stress-test_${ts}.html`]: htmlReport(data),
        [`reports/stress-test_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
