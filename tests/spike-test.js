import { sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { SPIKE_OPTIONS } from '../config/options.js';
import { login } from '../lib/auth.js';
import { getProducts, createOrder, getOrders } from '../lib/endpoints.js';
import { randomItem, randomInt, randomThinkTime, getTimestamp } from '../lib/helpers.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────
const SEARCH_TERMS = JSON.parse(open('../data/search-terms.json'));

// ─────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────
const checkoutDuration = new Trend('checkout_duration', true);
const checkoutErrors = new Rate('checkout_error_rate');
const responseTimeDuringSpike = new Trend('response_during_spike', true);

// ─────────────────────────────────────────────────────────────
// OPTIONS — Spike Test
// 5 VUs → 100 VUs in 10s, hold 30s, back to 5
// ─────────────────────────────────────────────────────────────
export const options = {
    ...SPIKE_OPTIONS,
    thresholds: {
        ...SPIKE_OPTIONS.thresholds,
        'checkout_duration': ['p(95)<5000'],
        'response_during_spike': ['p(95)<5000'],
    },
};

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
export function setup() {
    const token = login();
    if (!token) throw new Error('Authentication failed. Cannot run spike test.');

    const productsData = getProducts(token, { page: 1, pageSize: 50 });
    const skus = [];
    if (productsData && productsData.data && productsData.data.items) {
        productsData.data.items.forEach((p) => {
            if (p.stock > 0) skus.push(p.sku);
        });
    }

    console.log(`⚡ Spike Test Setup: ${skus.length} SKUs loaded`);
    return { token, skus };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FUNCTION — Flash-sale simulation
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token, skus } = data;

    // Simulate a "Cyber Sale" rush: most users are trying to buy
    const journey = Math.random();

    if (journey < 0.40) {
        // 40% — Quick product search → buy
        flashSaleBuy(token, skus);
    } else if (journey < 0.70) {
        // 30% — Product browsing (search heavy)
        const start = Date.now();
        getProducts(token, { search: randomItem(SEARCH_TERMS), page: 1, pageSize: 20 });
        responseTimeDuringSpike.add(Date.now() - start);
        sleep(randomThinkTime(0.5, 1.5));
    } else if (journey < 0.90) {
        // 20% — Quick product list
        const start = Date.now();
        getProducts(token, { page: randomInt(1, 20), pageSize: 20 });
        responseTimeDuringSpike.add(Date.now() - start);
        sleep(randomThinkTime(0.5, 1));
    } else {
        // 10% — Check orders
        const start = Date.now();
        getOrders(token, { page: 1, pageSize: 20 });
        responseTimeDuringSpike.add(Date.now() - start);
        sleep(randomThinkTime(0.5, 1));
    }
}

function flashSaleBuy(token, skus) {
    // Quick search
    const productsData = getProducts(token, { page: randomInt(1, 5), pageSize: 10 });
    sleep(randomThinkTime(0.3, 0.8));

    let sku;
    if (productsData && productsData.data && productsData.data.items && productsData.data.items.length > 0) {
        sku = randomItem(productsData.data.items).sku;
    } else if (skus.length > 0) {
        sku = randomItem(skus);
    } else return;

    const start = Date.now();
    const orderRes = createOrder(token, [{ sku, quantity: 1 }], 'spike@loadtest.com');
    const elapsed = Date.now() - start;
    checkoutDuration.add(elapsed);
    responseTimeDuringSpike.add(elapsed);

    if (orderRes.status === 200) {
        checkoutErrors.add(0);
    } else if (orderRes.status === 409) {
        checkoutErrors.add(0); // Stock conflict is expected
    } else {
        checkoutErrors.add(1);
    }

    sleep(randomThinkTime(0.3, 0.8));
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN & REPORT
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('⚡ Spike Test Complete.');
}

export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/spike-test_${ts}.html`]: htmlReport(data),
        [`reports/spike-test_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
