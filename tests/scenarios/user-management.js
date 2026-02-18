import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { login } from '../../lib/auth.js';
import { getUsers, createUser } from '../../lib/endpoints.js';
import { randomItem, randomInt, randomThinkTime, generateEmail, generateUserName, getTimestamp } from '../../lib/helpers.js';
import { check } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

// ─────────────────────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────────────────────
const userListDuration = new Trend('user_list_duration', true);
const userSearchDuration = new Trend('user_search_duration', true);
const userCreateDuration = new Trend('user_create_duration', true);
const deepUserPagination = new Trend('deep_user_pagination', true);
const userCreateSuccess = new Rate('user_create_success_rate');
const totalUsersCreated = new Counter('total_users_created');

// ─────────────────────────────────────────────────────────────
// SEARCH TERMS for user search
// ─────────────────────────────────────────────────────────────
const USER_SEARCH_TERMS = [
    'Performance',
    'New User',
    'LoadTest',
    'Admin',
    'Test',
    'User',
    'Manager',
];

// ─────────────────────────────────────────────────────────────
// OPTIONS — User Management Scenario
// ─────────────────────────────────────────────────────────────
export const options = {
    scenarios: {
        user_management: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '30s', target: 5 },
                { duration: '2m', target: 10 },
                { duration: '1m', target: 15 },
                { duration: '30s', target: 0 },
            ],
        },
    },
    thresholds: {
        'user_list_duration': ['p(95)<2000'],
        'user_search_duration': ['p(95)<2000'],
        'user_create_duration': ['p(95)<2000'],
        'deep_user_pagination': ['p(95)<5000'],
        'user_create_success_rate': ['rate>0.90'],
        'http_req_failed': ['rate<0.05'],
    },
};

// ─────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────
export function setup() {
    const token = login();
    if (!token) throw new Error('Authentication failed.');
    console.log('👥 User Management Scenario: Ready');
    return { token };
}

// ─────────────────────────────────────────────────────────────
// DEFAULT — User management patterns
// ─────────────────────────────────────────────────────────────
export default function (data) {
    const { token } = data;
    const pattern = Math.random();

    if (pattern < 0.35) {
        // 35% — List users with normal pagination
        listUsers(token);
    } else if (pattern < 0.60) {
        // 25% — Search users
        searchUsers(token);
    } else if (pattern < 0.80) {
        // 20% — Create a new user
        createNewUser(token);
    } else {
        // 20% — Deep pagination (test skip/limit on 77K users)
        deepPaginateUsers(token);
    }
}

function listUsers(token) {
    const page = randomInt(1, 10);
    const start = Date.now();
    getUsers(token, { page, pageSize: 20 });
    userListDuration.add(Date.now() - start);
    sleep(randomThinkTime(1, 2));

    // Browse next page
    const start2 = Date.now();
    getUsers(token, { page: page + 1, pageSize: 20 });
    userListDuration.add(Date.now() - start2);
    sleep(randomThinkTime(1, 2));
}

function searchUsers(token) {
    const term = randomItem(USER_SEARCH_TERMS);
    const start = Date.now();
    getUsers(token, { search: term, page: 1, pageSize: 20 });
    userSearchDuration.add(Date.now() - start);
    sleep(randomThinkTime(1, 3));
}

function createNewUser(token) {
    const name = generateUserName();
    const email = generateEmail();

    const start = Date.now();
    const result = createUser(token, { name, email });
    userCreateDuration.add(Date.now() - start);

    if (result && result.success) {
        userCreateSuccess.add(1);
        totalUsersCreated.add(1);
    } else {
        userCreateSuccess.add(0);
    }

    sleep(randomThinkTime(1, 2));
}

function deepPaginateUsers(token) {
    // ~77K users, pageSize 20 = ~3856 pages
    const pages = [100, 500, 1000, 2000, 3000];
    const page = randomItem(pages);

    const start = Date.now();
    getUsers(token, { page, pageSize: 20 });
    deepUserPagination.add(Date.now() - start);
    sleep(randomThinkTime(1, 2));
}

// ─────────────────────────────────────────────────────────────
// TEARDOWN & REPORT
// ─────────────────────────────────────────────────────────────
export function teardown(data) {
    console.log('👥 User Management Scenario Complete.');
}

export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [`reports/user-management_${ts}.html`]: htmlReport(data),
        [`reports/user-management_${ts}.json`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}
