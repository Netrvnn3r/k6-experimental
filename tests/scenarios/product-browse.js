import { sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { login } from '../../lib/auth.js';
import { getProducts } from '../../lib/endpoints.js';
import { randomItem, randomInt, randomThinkTime, getTimestamp } from '../../lib/helpers.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────
const SEARCH_TERMS = JSON.parse(open('../../data/search-terms.json'));
const CATEGORIES = JSON.parse(open('../../data/categories.json'));

// ─────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────
const searchDuration = new Trend('product_search_duration', true);
const paginationDuration = new Trend('pagination_duration', true);
const categoryFilterDuration = new Trend('category_filter_duration', true);
const deepPaginationDuration = new Trend('deep_pagination_duration', true);
const emptySearchResults = new Counter('empty_search_results');

// ─────────────────────────────────────────────────────────────
// OPTIONS — Product Browse Scenario
// ─────────────────────────────────────────────────────────────
export const options = {
    scenarios: {
        product_browsing: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 10 },
                { duration: '2m', target: 15 },
                { duration: '1m', target: 25 },
                { duration: '1m', target: 25 },
                { duration: '30s', target: 0 },
            ],
        },
    },
    thresholds: {
        'product_search_duration': ['p(95)<2000', 'p(99)<4000'],
        'pagination_duration': ['p(95)<2000'],
        'category_filter_duration': ['p(95)<2000'],
        'deep_pagination_duration': ['p(95)<5000'],
        'http_req_failed': ['rate<0.05'],
    },
};

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
export function setup() {
    const token = login();
    if (!token) throw new Error('Authentication failed.');
    console.log('📦 Product Browse Scenario: Ready');
    return { token };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT — Multiple product browsing patterns
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token } = data;
    const pattern = Math.random();

    if (pattern < 0.30) {
        // Pattern 1: Text search
        textSearch(token);
    } else if (pattern < 0.55) {
        // Pattern 2: Category browsing
        categoryBrowse(token);
    } else if (pattern < 0.75) {
        // Pattern 3: Normal pagination
        normalPagination(token);
    } else if (pattern < 0.90) {
        // Pattern 4: Deep pagination (known cost — measures MongoDB skip/limit)
        deepPagination(token);
    } else {
        // Pattern 5: Combined search + category + pagination
        combinedSearch(token);
    }
}

function textSearch(token) {
    const term = randomItem(SEARCH_TERMS);
    const start = Date.now();
    const result = getProducts(token, { search: term, page: 1, pageSize: 20 });
    searchDuration.add(Date.now() - start);

    if (result && result.data && result.data.total === 0) {
        emptySearchResults.add(1);
    }

    sleep(randomThinkTime(1, 3));

    // Second page of results
    if (result && result.data && result.data.total > 20) {
        const start2 = Date.now();
        getProducts(token, { search: term, page: 2, pageSize: 20 });
        paginationDuration.add(Date.now() - start2);
        sleep(randomThinkTime(1, 2));
    }
}

function categoryBrowse(token) {
    const category = randomItem(CATEGORIES);
    const start = Date.now();
    getProducts(token, { category, page: 1, pageSize: 20 });
    categoryFilterDuration.add(Date.now() - start);
    sleep(randomThinkTime(1, 3));

    // Browse second page
    const start2 = Date.now();
    getProducts(token, { category, page: 2, pageSize: 20 });
    paginationDuration.add(Date.now() - start2);
    sleep(randomThinkTime(1, 2));
}

function normalPagination(token) {
    // Browse through first 5 pages
    for (let page = 1; page <= 3; page++) {
        const start = Date.now();
        getProducts(token, { page, pageSize: 20 });
        paginationDuration.add(Date.now() - start);
        sleep(randomThinkTime(0.5, 1.5));
    }
}

function deepPagination(token) {
    // Test high page numbers — known to have increased cost with skip/limit
    const pages = [50, 100, 200, 500];
    const page = randomItem(pages);

    const start = Date.now();
    getProducts(token, { page, pageSize: 20 });
    deepPaginationDuration.add(Date.now() - start);
    sleep(randomThinkTime(1, 2));
}

function combinedSearch(token) {
    // Search + category filter
    const term = randomItem(SEARCH_TERMS);
    const category = randomItem(CATEGORIES);

    const start = Date.now();
    getProducts(token, { search: term, category, page: 1, pageSize: 20 });
    searchDuration.add(Date.now() - start);
    sleep(randomThinkTime(1, 2));

    // Different page size
    const start2 = Date.now();
    getProducts(token, { search: term, page: 1, pageSize: 50 });
    searchDuration.add(Date.now() - start2);
    sleep(randomThinkTime(1, 2));
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN & REPORT
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('📦 Product Browse Scenario Complete.');
}

export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/product-browse_${ts}.html`]: htmlReport(data),
        [`reports/product-browse_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
