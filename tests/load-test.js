import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { LOAD_OPTIONS } from '../config/options.js';
import { login, getAuthHeaders } from '../lib/auth.js';
import { getProducts, getUsers, createOrder, getOrders } from '../lib/endpoints.js';
import { randomItem, randomInt, randomThinkTime, parseResponse, getTimestamp } from '../lib/helpers.js';
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
const productSearchDuration = new Trend('product_search_duration', true);
const paginationDuration = new Trend('pagination_duration', true);
const orderConflicts = new Counter('order_stock_conflicts');

// ─────────────────────────────────────────────────────────────
// OPTIONS — Load Test
// Ramp: 0→20 VUs (2 min) → steady 20 (5 min) → down (1 min)
// ─────────────────────────────────────────────────────────────
export const options = {
    ...LOAD_OPTIONS,
    thresholds: {
        ...LOAD_OPTIONS.thresholds,
        'checkout_duration': ['p(95)<3000'],
        'checkout_error_rate': ['rate<0.10'],
        'product_search_duration': ['p(95)<2000'],
    },
};

// ─────────────────────────────────────────────────────────────
// SETUP — Authenticate
// ─────────────────────────────────────────────────────────────
export function setup() {
    const token = login();
    if (!token) {
        throw new Error('Authentication failed. Cannot run load test.');
    }

    // Fetch initial product data for SKU pool
    const productsData = getProducts(token, { page: 1, pageSize: 50 });
    const skus = [];
    if (productsData && productsData.data && productsData.data.items) {
        productsData.data.items.forEach((p) => {
            if (p.stock > 0) {
                skus.push(p.sku);
            }
        });
    }

    console.log(`📊 Load Test Setup: ${skus.length} SKUs available for orders`);
    return { token, skus };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FUNCTION — Mixed workload simulation
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token, skus } = data;

    // Randomly pick a user journey for this iteration
    const journey = Math.random();

    if (journey < 0.50) {
        // 50% — Product browsing (search + pagination)
        browseProducts(token);
    } else if (journey < 0.75) {
        // 25% — Checkout flow
        checkoutFlow(token, skus);
    } else if (journey < 0.90) {
        // 15% — Browse users
        browseUsers(token);
    } else {
        // 10% — View orders
        viewOrders(token);
    }
}

/**
 * Product browsing journey: search → paginate → filter by category
 */
function browseProducts(token) {
    // Step 1: Search for a random term
    const searchTerm = randomItem(SEARCH_TERMS);
    const startSearch = Date.now();
    getProducts(token, { search: searchTerm, page: 1, pageSize: 20 });
    productSearchDuration.add(Date.now() - startSearch);
    sleep(randomThinkTime(1, 2));

    // Step 2: Paginate to a random page
    const randomPage = randomInt(1, 10);
    const startPagination = Date.now();
    getProducts(token, { page: randomPage, pageSize: 20 });
    paginationDuration.add(Date.now() - startPagination);
    sleep(randomThinkTime(0.5, 1.5));

    // Step 3: Filter by category
    const category = randomItem(CATEGORIES);
    getProducts(token, { category: category, page: 1, pageSize: 20 });
    sleep(randomThinkTime(1, 2));
}

/**
 * Checkout journey: search → find product → create order
 */
function checkoutFlow(token, skus) {
    // Step 1: Browse products to find something
    const productsData = getProducts(token, { page: randomInt(1, 5), pageSize: 10 });
    sleep(randomThinkTime(1, 2));

    // Step 2: Attempt to create an order
    let sku;
    if (productsData && productsData.data && productsData.data.items && productsData.data.items.length > 0) {
        const product = randomItem(productsData.data.items);
        sku = product.sku;
    } else if (skus.length > 0) {
        sku = randomItem(skus);
    } else {
        return; // No products available
    }

    const startCheckout = Date.now();
    const orderRes = createOrder(token, [{ sku: sku, quantity: 1 }], 'loadtest@performance.com');
    const elapsed = Date.now() - startCheckout;
    checkoutDuration.add(elapsed);

    if (orderRes.status === 409) {
        orderConflicts.add(1);
        checkoutErrors.add(0); // stock conflict is expected, not an error
    } else if (orderRes.status === 200) {
        checkoutErrors.add(0);
    } else {
        checkoutErrors.add(1);
    }

    sleep(randomThinkTime(1, 3));
}

/**
 * User browsing journey: list users → search
 */
function browseUsers(token) {
    getUsers(token, { page: randomInt(1, 20), pageSize: 20 });
    sleep(randomThinkTime(1, 2));

    getUsers(token, { search: 'Performance', page: 1, pageSize: 20 });
    sleep(randomThinkTime(1, 2));
}

/**
 * Order viewing journey: list orders with filters
 */
function viewOrders(token) {
    getOrders(token, { page: 1, pageSize: 20 });
    sleep(randomThinkTime(1, 2));

    getOrders(token, { status: 'pending', page: 1, pageSize: 20 });
    sleep(randomThinkTime(1, 2));
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('📊 Load Test Complete.');
}

// ─────────────────────────────────────────────────────────────
// REPORT — HTML + Console summary
// ─────────────────────────────────────────────────────────────
export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/load-test_${ts}.html`]: htmlReport(data),
        [`reports/load-test_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
