/**
 * Test Configuration Options Module
 * Centralized K6 options profiles for different test types.
 * 
 * Each profile defines: stages, thresholds, and scenario executors.
 * Import the one you need in your test script.
 */

// ─────────────────────────────────────────────────────────────
// SHARED THRESHOLDS
// ─────────────────────────────────────────────────────────────
export const BASE_THRESHOLDS = {
    // Global HTTP metrics
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],  // 95th < 2s, 99th < 5s
    'http_req_failed': ['rate<0.05'],                   // Less than 5% failures
    'http_reqs': ['rate>5'],                      // At least 5 req/s throughput

    // Per-endpoint thresholds (using tags)
    'http_req_duration{name:AUTH_Login}': ['p(95)<1000'],
    'http_req_duration{name:PRODUCTS_List}': ['p(95)<1500'],
    'http_req_duration{name:ORDERS_Create}': ['p(95)<3000'],  // Higher due to CPU loop
    'http_req_duration{name:USERS_List}': ['p(95)<1500'],
};

// ─────────────────────────────────────────────────────────────
// SMOKE TEST — Quick validation (1 VU, 1 iteration)
// ─────────────────────────────────────────────────────────────
export const SMOKE_OPTIONS = {
    vus: 1,
    iterations: 1,
    thresholds: {
        'http_req_duration': ['p(95)<3000'],
        'http_req_failed': ['rate<0.10'],
    },
};

// ─────────────────────────────────────────────────────────────
// LOAD TEST — Standard traffic simulation
// Ramp: 0→20 VUs (2 min) → steady 20 VUs (5 min) → ramp down (1 min)
// ─────────────────────────────────────────────────────────────
export const LOAD_OPTIONS = {
    stages: [
        { duration: '2m', target: 20 },   // Ramp up
        { duration: '5m', target: 20 },   // Steady state
        { duration: '1m', target: 0 },   // Ramp down
    ],
    thresholds: {
        ...BASE_THRESHOLDS,
    },
};

// ─────────────────────────────────────────────────────────────
// STRESS TEST — Push to breaking point
// Progressive ramp: 0→20→50→100→150 VUs
// ─────────────────────────────────────────────────────────────
export const STRESS_OPTIONS = {
    stages: [
        { duration: '1m', target: 20 },  // Warm up
        { duration: '2m', target: 50 },  // Moderate load
        { duration: '2m', target: 100 },  // Heavy load
        { duration: '2m', target: 150 },  // Breaking point
        { duration: '1m', target: 0 },  // Recovery
    ],
    thresholds: {
        'http_req_duration': ['p(95)<5000'],
        'http_req_failed': ['rate<0.15'],   // Higher tolerance under stress
    },
};

// ─────────────────────────────────────────────────────────────
// SPIKE TEST — Sudden traffic surge
// 5 VUs → 100 VUs in 10s, hold 30s, back to 5
// ─────────────────────────────────────────────────────────────
export const SPIKE_OPTIONS = {
    stages: [
        { duration: '30s', target: 5 },  // Baseline
        { duration: '10s', target: 100 },  // Spike!
        { duration: '30s', target: 100 },  // Hold spike
        { duration: '10s', target: 5 },  // Recovery
        { duration: '30s', target: 5 },  // Observe recovery
    ],
    thresholds: {
        'http_req_duration': ['p(95)<5000'],
        'http_req_failed': ['rate<0.20'],   // Spikes may cause some failures
    },
};

// ─────────────────────────────────────────────────────────────
// SOAK TEST — Extended duration for leak detection
// 15 VUs for 15 minutes
// ─────────────────────────────────────────────────────────────
export const SOAK_OPTIONS = {
    stages: [
        { duration: '1m', target: 15 },   // Ramp up
        { duration: '15m', target: 15 },   // Sustained load
        { duration: '1m', target: 0 },   // Ramp down
    ],
    thresholds: {
        ...BASE_THRESHOLDS,
    },
};
