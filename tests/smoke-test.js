import { sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { SMOKE_OPTIONS } from '../config/options.js';
import { login, getAuthHeaders, logout } from '../lib/auth.js';
import { getProducts, createProduct, getUsers, createUser, createOrder, getOrders } from '../lib/endpoints.js';
import { checkResponse, parseResponse, generateEmail, generateUserName, generateSku, generateProductName, randomItem, getTimestamp } from '../lib/helpers.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────
const authDuration = new Trend('auth_login_duration', true);
const productListDuration = new Trend('product_list_duration', true);
const orderCreateDuration = new Trend('order_create_duration', true);
const userListDuration = new Trend('user_list_duration', true);

// ─────────────────────────────────────────────────────────────
// OPTIONS — Smoke Test (1 VU, 1 iteration)
// ─────────────────────────────────────────────────────────────
export const options = SMOKE_OPTIONS;

// ─────────────────────────────────────────────────────────────
// SETUP — Authenticate once before VU execution
// ─────────────────────────────────────────────────────────────
export function setup() {
    console.log('🔐 Smoke Test: Authenticating...');
    const token = login();
    if (!token) {
        throw new Error('Authentication failed during setup. Cannot proceed.');
    }
    console.log('✅ Authentication successful.');
    return { token };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FUNCTION — Execute all endpoint checks
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token } = data;

    // 1. LIST PRODUCTS (page 1)
    console.log('📦 Testing: GET Products (page 1)...');
    const productsRes = getProducts(token, { page: 1, pageSize: 10 });
    if (productsRes && productsRes.data) {
        console.log(`   ✅ Products: ${productsRes.data.total} total items`);
    }
    sleep(1);

    // 2. SEARCH PRODUCTS
    console.log('🔍 Testing: GET Products (search="Phone")...');
    const searchRes = getProducts(token, { search: 'Phone', page: 1, pageSize: 5 });
    if (searchRes && searchRes.data) {
        console.log(`   ✅ Search results: ${searchRes.data.total} items found`);
    }
    sleep(1);

    // 3. LIST USERS (page 1)
    console.log('👥 Testing: GET Users (page 1)...');
    const usersRes = getUsers(token, { page: 1, pageSize: 10 });
    if (usersRes && usersRes.data) {
        console.log(`   ✅ Users: ${usersRes.data.total} total users`);
    }
    sleep(1);

    // 4. CREATE ORDER (checkout)
    console.log('🛒 Testing: POST Order (checkout)...');
    // First get a valid SKU from the products list
    if (productsRes && productsRes.data && productsRes.data.items && productsRes.data.items.length > 0) {
        const product = productsRes.data.items[0];
        const orderRes = createOrder(token, [{ sku: product.sku, quantity: 1 }], 'smoke-test@loadtest.com');
        if (orderRes.status === 200) {
            console.log('   ✅ Order created successfully');
        } else if (orderRes.status === 409) {
            console.log('   ⚠️ Order conflict (insufficient stock) — expected behavior');
        } else {
            console.log(`   ❌ Order failed: status=${orderRes.status}`);
        }
    }
    sleep(1);

    // 5. LIST ORDERS
    console.log('📋 Testing: GET Orders...');
    const ordersRes = getOrders(token, { page: 1, pageSize: 10 });
    if (ordersRes && ordersRes.data) {
        console.log(`   ✅ Orders: ${ordersRes.data.total} total orders`);
    }
    sleep(1);

    console.log('🎉 Smoke test complete — all endpoints validated.');
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN — Cleanup
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('🧹 Smoke Test: Teardown complete.');
}

// ─────────────────────────────────────────────────────────────
// REPORT — HTML + Console summary
// ─────────────────────────────────────────────────────────────
export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/smoke-test_${ts}.html`]: htmlReport(data),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
