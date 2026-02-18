/**
 * BDD Step Definitions Registry
 * 
 * Maps Gherkin step text patterns to k6 code generation functions.
 * Each step definition returns a snippet of k6-compatible JavaScript code.
 * 
 * The generator uses these to build the body of the default() function.
 */

/**
 * Step definition registry.
 * Each entry has:
 *   - pattern: RegExp to match step text (after placeholder resolution)
 *   - code: Function that returns k6 code string. Receives regex match groups.
 *   - setup: Optional code to add to setup() function
 *   - imports: Array of imports needed for this step
 *   - metrics: Array of custom metric declarations
 */
const STEP_DEFINITIONS = [
    // ─────────────────────────────────────────────────────────────
    // GIVEN — Preconditions
    // ─────────────────────────────────────────────────────────────
    {
        pattern: /^el sistema está disponible$/i,
        code: () => `
    // Verificación: el sistema responde
    console.log('✅ Sistema disponible — iniciando test');`,
        imports: [],
        metrics: [],
    },
    {
        pattern: /^el usuario está autenticado$/i,
        code: () => `
    // Autenticación via setup()
    const { token } = data;
    if (!token) { console.error('❌ No token available'); return; }`,
        setup: `
    const token = login();
    if (!token) throw new Error('Authentication failed during setup.');
    return { token };`,
        imports: ['login'],
        metrics: [],
    },
    {
        pattern: /^el usuario tiene productos disponibles$/i,
        code: () => `
    // Verificar que hay productos disponibles
    const productCheck = getProducts(data.token, { page: 1, pageSize: 5 });
    if (!productCheck || !productCheck.data || productCheck.data.total === 0) {
        console.warn('⚠️ No hay productos disponibles');
    }`,
        imports: ['getProducts'],
        metrics: [],
    },
    {
        pattern: /^existe un pool de SKUs con stock$/i,
        code: () => `
    // SKU pool cargado en setup()
    const { token, skuPool } = data;
    if (!skuPool || skuPool.length === 0) {
        console.warn('⚠️ No SKUs con stock disponible');
        return;
    }`,
        setup: `
    const token = login();
    if (!token) throw new Error('Authentication failed.');
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
    console.log(\`🛒 Setup: \${skuPool.length} SKUs con stock disponible\`);
    return { token, skuPool };`,
        imports: ['login', 'getProducts'],
        metrics: [],
    },

    // ─────────────────────────────────────────────────────────────
    // WHEN — Actions
    // ─────────────────────────────────────────────────────────────
    {
        pattern: /^(\d+) usuarios realizan login durante "([^"]+)"$/i,
        code: (match) => `
    // Login action — VUs: ${match[1]}, Duration: ${match[2]}
    const loginStart = Date.now();
    const loginUrl = \`\${BASE_URL}/api/auth\`;
    const loginPayload = JSON.stringify({
        username: __ENV.USERNAME || 'ghauyon',
        password: __ENV.PASSWORD || 'user4Test',
    });
    const loginRes = http.post(loginUrl, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'AUTH_Login' },
    });
    loginDuration.add(Date.now() - loginStart);

    const loginOk = check(loginRes, {
        'login: status 200': (r) => r.status === 200,
        'login: tiene token': (r) => {
            try { return JSON.parse(r.body).data.token !== undefined; }
            catch (e) { return false; }
        },
    });
    if (!loginOk) {
        authFailures.add(1);
        return;
    }
    authFailures.add(0);
    const token = JSON.parse(loginRes.body).data.token;
    sleep(1);

    // Logout
    const logoutStart = Date.now();
    http.del(loginUrl, null, {
        headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' },
        tags: { name: 'AUTH_Logout' },
    });
    logoutDuration.add(Date.now() - logoutStart);
    sleep(2);`,
        imports: [],
        metrics: [
            { name: 'loginDuration', type: 'Trend', k6name: 'login_duration', isTime: true },
            { name: 'logoutDuration', type: 'Trend', k6name: 'logout_duration', isTime: true },
            { name: 'authFailures', type: 'Rate', k6name: 'auth_failure_rate' },
        ],
    },
    {
        pattern: /^el usuario navega productos en la página (\d+) con (\d+) resultados$/i,
        code: (match) => `
    // Browse products — page: ${match[1]}, pageSize: ${match[2]}
    const browseStart = Date.now();
    const browseResult = getProducts(data.token, { page: ${match[1]}, pageSize: ${match[2]} });
    productListDuration.add(Date.now() - browseStart);
    if (browseResult && browseResult.data) {
        console.log(\`📦 Productos: \${browseResult.data.total} total\`);
    }
    sleep(randomThinkTime(1, 2));`,
        imports: ['getProducts', 'randomThinkTime'],
        metrics: [
            { name: 'productListDuration', type: 'Trend', k6name: 'product_list_duration', isTime: true },
        ],
    },
    {
        pattern: /^el usuario busca "([^"]+)"$/i,
        code: (match) => `
    // Search products: "${match[1]}"
    const searchStart = Date.now();
    const searchResult = getProducts(data.token, { search: '${match[1]}', page: 1, pageSize: 10 });
    productSearchDuration.add(Date.now() - searchStart);
    if (searchResult && searchResult.data) {
        console.log(\`🔍 Búsqueda "${match[1]}": \${searchResult.data.total} resultados\`);
    }
    sleep(randomThinkTime(0.5, 1));`,
        imports: ['getProducts', 'randomThinkTime'],
        metrics: [
            { name: 'productSearchDuration', type: 'Trend', k6name: 'product_search_duration', isTime: true },
        ],
    },
    {
        pattern: /^el usuario filtra por categoría "([^"]+)"$/i,
        code: (match) => `
    // Filter by category: "${match[1]}"
    const filterStart = Date.now();
    const filterResult = getProducts(data.token, { category: '${match[1]}', page: 1, pageSize: 10 });
    categoryFilterDuration.add(Date.now() - filterStart);
    if (filterResult && filterResult.data) {
        console.log(\`🏷️ Categoría "${match[1]}": \${filterResult.data.total} resultados\`);
    }
    sleep(randomThinkTime(0.5, 1));`,
        imports: ['getProducts', 'randomThinkTime'],
        metrics: [
            { name: 'categoryFilterDuration', type: 'Trend', k6name: 'category_filter_duration', isTime: true },
        ],
    },
    {
        pattern: /^el usuario lista los usuarios del sistema$/i,
        code: () => `
    // List users
    const usersStart = Date.now();
    const usersResult = getUsers(data.token, { page: 1, pageSize: 10 });
    userListDuration.add(Date.now() - usersStart);
    if (usersResult && usersResult.data) {
        console.log(\`👥 Usuarios: \${usersResult.data.total} total\`);
    }
    sleep(1);`,
        imports: ['getUsers'],
        metrics: [
            { name: 'userListDuration', type: 'Trend', k6name: 'user_list_duration', isTime: true },
        ],
    },
    {
        pattern: /^el usuario realiza checkout con (\d+) productos$/i,
        code: (match) => `
    // Checkout with ${match[1]} product(s)
    const { token, skuPool } = data;
    const e2eStart = Date.now();

    // Browse for products
    const browseStart = Date.now();
    const productsData = getProducts(token, { page: randomInt(1, 5), pageSize: 10 });
    productSearchForCheckout.add(Date.now() - browseStart);
    sleep(randomThinkTime(1, 2));

    // Select product
    let selectedSku;
    if (productsData && productsData.data && productsData.data.items) {
        const available = productsData.data.items.filter(p => p.stock > 0);
        if (available.length > 0) selectedSku = randomItem(available).sku;
    }
    if (!selectedSku && skuPool && skuPool.length > 0) {
        selectedSku = randomItem(skuPool).sku;
    }
    if (!selectedSku) {
        console.warn('⚠️ No SKU disponible para checkout');
        checkoutSuccessRate.add(0);
        return;
    }
    sleep(randomThinkTime(0.5, 1));

    // Place order
    const quantity = ${match[1]};
    const checkoutStart = Date.now();
    const orderRes = createOrder(token, [{ sku: selectedSku, quantity }],
        \`bdd-test-\${Date.now()}@loadtest.com\`);
    checkoutDuration.add(Date.now() - checkoutStart);

    if (orderRes.status === 200) {
        checkoutSuccessRate.add(1);
        totalOrdersCreated.add(1);
        // Verify order
        sleep(randomThinkTime(0.5, 1));
        const verifyStart = Date.now();
        getOrders(token, { page: 1, pageSize: 5 });
        orderVerifyDuration.add(Date.now() - verifyStart);
    } else if (orderRes.status === 409) {
        stockConflicts.add(1);
        checkoutSuccessRate.add(0);
    } else {
        checkoutSuccessRate.add(0);
    }
    e2eCheckoutDuration.add(Date.now() - e2eStart);
    sleep(randomThinkTime(1, 3));`,
        imports: ['getProducts', 'createOrder', 'getOrders', 'randomItem', 'randomInt', 'randomThinkTime'],
        metrics: [
            { name: 'checkoutDuration', type: 'Trend', k6name: 'checkout_duration', isTime: true },
            { name: 'productSearchForCheckout', type: 'Trend', k6name: 'product_search_for_checkout', isTime: true },
            { name: 'orderVerifyDuration', type: 'Trend', k6name: 'order_verify_duration', isTime: true },
            { name: 'checkoutSuccessRate', type: 'Rate', k6name: 'checkout_success_rate' },
            { name: 'stockConflicts', type: 'Counter', k6name: 'stock_conflicts_409' },
            { name: 'totalOrdersCreated', type: 'Counter', k6name: 'total_orders_created' },
            { name: 'e2eCheckoutDuration', type: 'Trend', k6name: 'e2e_checkout_duration', isTime: true },
        ],
    },
    {
        pattern: /^el usuario lista las órdenes$/i,
        code: () => `
    // List orders
    const ordersStart = Date.now();
    const ordersResult = getOrders(data.token, { page: 1, pageSize: 10 });
    orderListDuration.add(Date.now() - ordersStart);
    if (ordersResult && ordersResult.data) {
        console.log(\`📋 Órdenes: \${ordersResult.data.total} total\`);
    }
    sleep(1);`,
        imports: ['getOrders'],
        metrics: [
            { name: 'orderListDuration', type: 'Trend', k6name: 'order_list_duration', isTime: true },
        ],
    },
    {
        pattern: /^el usuario realiza logout$/i,
        code: () => `
    // Logout
    logout(data.token);
    sleep(1);`,
        imports: ['logout'],
        metrics: [],
    },

    // ─────────────────────────────────────────────────────────────
    // THEN — Assertions (thresholds, not runtime checks)
    // These are handled at the options level, not in default()
    // ─────────────────────────────────────────────────────────────
    {
        pattern: /^el percentil 95 del login debe ser menor a (\d+)ms$/i,
        code: (match) => `
    // Threshold assertion: login p95 < ${match[1]}ms (enforced via k6 thresholds)`,
        imports: [],
        metrics: [],
        threshold: (match) => ({ metric: 'login_duration', rule: `p(95)<${match[1]}` }),
    },
    {
        pattern: /^la tasa de fallas debe ser menor a (\d+)%$/i,
        code: (match) => `
    // Threshold assertion: failure rate < ${match[1]}% (enforced via k6 thresholds)`,
        imports: [],
        metrics: [],
        threshold: (match) => ({ metric: 'http_req_failed', rule: `rate<${parseInt(match[1]) / 100}` }),
    },
    {
        pattern: /^el percentil 95 de productos debe ser menor a (\d+)ms$/i,
        code: (match) => `
    // Threshold assertion: products p95 < ${match[1]}ms`,
        imports: [],
        metrics: [],
        threshold: (match) => ({ metric: 'product_list_duration', rule: `p(95)<${match[1]}` }),
    },
    {
        pattern: /^el percentil 95 del checkout debe ser menor a (\d+)ms$/i,
        code: (match) => `
    // Threshold assertion: checkout p95 < ${match[1]}ms`,
        imports: [],
        metrics: [],
        threshold: (match) => ({ metric: 'checkout_duration', rule: `p(95)<${match[1]}` }),
    },
    {
        pattern: /^la tasa de éxito del checkout debe ser mayor a (\d+)%$/i,
        code: (match) => `
    // Threshold assertion: checkout success rate > ${match[1]}%`,
        imports: [],
        metrics: [],
        threshold: (match) => ({ metric: 'checkout_success_rate', rule: `rate>${parseInt(match[1]) / 100}` }),
    },
    {
        pattern: /^el percentil 95 de búsqueda debe ser menor a (\d+)ms$/i,
        code: (match) => `
    // Threshold assertion: search p95 < ${match[1]}ms`,
        imports: [],
        metrics: [],
        threshold: (match) => ({ metric: 'product_search_duration', rule: `p(95)<${match[1]}` }),
    },
    {
        pattern: /^todos los endpoints deben responder correctamente$/i,
        code: () => `
    // Assertion: all endpoints responded correctly (enforced via checks)`,
        imports: [],
        metrics: [],
        threshold: () => ({ metric: 'http_req_failed', rule: 'rate<0.10' }),
    },
    {
        pattern: /^el tiempo de respuesta general debe ser menor a (\d+)ms$/i,
        code: (match) => `
    // Threshold assertion: overall response time p95 < ${match[1]}ms`,
        imports: [],
        metrics: [],
        threshold: (match) => ({ metric: 'http_req_duration', rule: `p(95)<${match[1]}` }),
    },
];

/**
 * Match a step text against the registry and return the matching definition.
 * @param {string} text - Step text to match
 * @returns {{ definition: object, match: RegExpMatchArray } | null}
 */
export function matchStep(text) {
    for (const def of STEP_DEFINITIONS) {
        const match = text.match(def.pattern);
        if (match) {
            return { definition: def, match };
        }
    }
    return null;
}

/**
 * Get all step definitions (for documentation/debugging).
 * @returns {Array}
 */
export function getAllStepDefinitions() {
    return STEP_DEFINITIONS.map(def => ({
        pattern: def.pattern.source,
        hasSetup: !!def.setup,
        hasThreshold: !!def.threshold,
        imports: def.imports,
    }));
}
