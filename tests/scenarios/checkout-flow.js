import { sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { login } from '../../lib/auth.js';
import { getProducts, createOrder, getOrders } from '../../lib/endpoints.js';
import { randomItem, randomInt, randomThinkTime, parseResponse, getTimestamp } from '../../lib/helpers.js';
import { check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─────────────────────────────────────────────────────────────
// CUSTOM METRICS — Checkout-specific
// ─────────────────────────────────────────────────────────────
const checkoutDuration = new Trend('checkout_duration', true);
const productSearchForCheckout = new Trend('product_search_for_checkout', true);
const orderVerificationDuration = new Trend('order_verification_duration', true);
const checkoutSuccessRate = new Rate('checkout_success_rate');
const stockConflicts = new Counter('stock_conflicts_409');
const serverErrors = new Counter('server_errors_5xx');
const totalOrdersCreated = new Counter('total_orders_created');
const e2eCheckoutDuration = new Trend('e2e_checkout_duration', true);

// ─────────────────────────────────────────────────────────────
// OPTIONS — Checkout Flow Scenario
// This is the CRITICAL PATH — targets the known CPU busy-loop
// ─────────────────────────────────────────────────────────────
export const options = {
    scenarios: {
        checkout_flow: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 5 },   // Warm up
                { duration: '1m', target: 10 },   // Moderate checkout load
                { duration: '2m', target: 20 },   // Peak checkout concurrency
                { duration: '1m', target: 20 },   // Sustained peak
                { duration: '30s', target: 0 },   // Recovery
            ],
        },
    },
    thresholds: {
        'checkout_duration': ['p(95)<3000', 'p(99)<5000'],
        'e2e_checkout_duration': ['p(95)<6000'],
        'product_search_for_checkout': ['p(95)<2000'],
        'order_verification_duration': ['p(95)<2000'],
        'checkout_success_rate': ['rate>0.70'],
        'http_req_failed': ['rate<0.10'],
    },
};

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
export function setup() {
    const token = login();
    if (!token) throw new Error('Authentication failed.');

    // Pre-load a pool of SKUs with stock
    const skuPool = [];
    for (let page = 1; page <= 3; page++) {
        const result = getProducts(token, { page, pageSize: 50 });
        if (result && result.data && result.data.items) {
            result.data.items.forEach((p) => {
                if (p.stock > 0) {
                    skuPool.push({ sku: p.sku, stock: p.stock, name: p.name });
                }
            });
        }
    }

    console.log(`🛒 Checkout Scenario Setup: ${skuPool.length} SKUs with stock available`);
    return { token, skuPool };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT — Full E2E checkout cycle
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token, skuPool } = data;
    const e2eStart = Date.now();

    // Step 1: Search/browse for products (simulates user finding items)
    const searchStart = Date.now();
    const productsData = getProducts(token, {
        page: randomInt(1, 10),
        pageSize: 10,
    });
    productSearchForCheckout.add(Date.now() - searchStart);
    sleep(randomThinkTime(1, 2));

    // Step 2: Select product and add to cart (pick a SKU)
    let selectedSku;
    if (productsData && productsData.data && productsData.data.items) {
        const availableItems = productsData.data.items.filter((p) => p.stock > 0);
        if (availableItems.length > 0) {
            selectedSku = randomItem(availableItems).sku;
        }
    }

    // Fallback to pre-loaded SKU pool
    if (!selectedSku && skuPool.length > 0) {
        selectedSku = randomItem(skuPool).sku;
    }

    if (!selectedSku) {
        console.warn('No SKU available for checkout');
        checkoutSuccessRate.add(0);
        return;
    }

    sleep(randomThinkTime(0.5, 1)); // Think time: reviewing product

    // Step 3: Place order (the CPU-intensive operation)
    const quantity = randomInt(1, 2);
    const checkoutStart = Date.now();
    const orderRes = createOrder(
        token,
        [{ sku: selectedSku, quantity }],
        `checkout-test-${Date.now()}@loadtest.com`
    );
    const checkoutElapsed = Date.now() - checkoutStart;
    checkoutDuration.add(checkoutElapsed);

    // Analyze result
    if (orderRes.status === 200) {
        checkoutSuccessRate.add(1);
        totalOrdersCreated.add(1);

        // Step 4: Verify order appears in order list
        sleep(randomThinkTime(0.5, 1));
        const verifyStart = Date.now();
        getOrders(token, { page: 1, pageSize: 5 });
        orderVerificationDuration.add(Date.now() - verifyStart);

    } else if (orderRes.status === 409) {
        stockConflicts.add(1);
        checkoutSuccessRate.add(0);
    } else if (orderRes.status >= 500) {
        serverErrors.add(1);
        checkoutSuccessRate.add(0);
    } else {
        checkoutSuccessRate.add(0);
    }

    e2eCheckoutDuration.add(Date.now() - e2eStart);
    sleep(randomThinkTime(1, 3));
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN & REPORT
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('🛒 Checkout Scenario Complete — review checkout_duration metrics for CPU bottleneck evidence.');
}

export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/checkout-flow_${ts}.html`]: htmlReport(data),
        [`reports/checkout-flow_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
