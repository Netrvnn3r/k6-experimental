/**
 * BDD K6 Script Generator
 * 
 * Takes parsed feature data (from parser.js) and generates valid k6 test scripts.
 * Each resolved scenario becomes a k6 script with proper options, setup, default, 
 * teardown, and handleSummary functions.
 */

import { matchStep } from './steps/index.js';
import fs from 'fs';
import path from 'path';

/**
 * Parse a k6 duration string like "30s", "2m", "1h" to seconds.
 * @param {string} duration 
 * @returns {number} seconds
 */
function parseDurationToSeconds(duration) {
    const match = duration.match(/^(\d+)(s|m|h)$/i);
    if (!match) return 60;
    const val = parseInt(match[1]);
    switch (match[2].toLowerCase()) {
        case 's': return val;
        case 'm': return val * 60;
        case 'h': return val * 3600;
        default: return 60;
    }
}

/**
 * Build k6 stages from VUs and duration parameters.
 * Creates a ramp-up → steady → ramp-down pattern.
 * @param {object} params - Scenario parameters
 * @returns {Array} k6 stages array
 */
function buildStages(params) {
    const vus = parseInt(params.vus) || 1;
    const duration = params.duration || '30s';
    const totalSeconds = parseDurationToSeconds(duration);

    // For smoke tests (1 VU, short duration)
    if (vus <= 1 && totalSeconds <= 30) {
        return null; // Use iterations instead
    }

    // Build ramp-up → steady → ramp-down stages
    const rampUp = Math.max(10, Math.floor(totalSeconds * 0.2));
    const steady = Math.max(10, totalSeconds - rampUp - Math.floor(totalSeconds * 0.15));
    const rampDown = Math.max(5, Math.floor(totalSeconds * 0.15));

    return [
        { duration: `${rampUp}s`, target: vus },
        { duration: `${steady}s`, target: vus },
        { duration: `${rampDown}s`, target: 0 },
    ];
}

/**
 * Generate a k6 script from a parsed feature with its resolved scenarios.
 * @param {object} feature - Parsed feature object from parser
 * @param {object} [options] - Generation options
 * @param {string} [options.outputDir] - Output directory for generated scripts
 * @returns {Array<{name: string, code: string, path: string}>} Generated scripts
 */
export function generateK6Scripts(feature, options = {}) {
    const outputDir = options.outputDir || path.resolve('tests/generated');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const generatedScripts = [];

    for (const scenario of feature.scenarios) {
        const script = generateSingleScript(feature, scenario);

        // Create filename from scenario name
        const safeName = scenario.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const fileName = `${safeName}.js`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, script, 'utf-8');

        generatedScripts.push({
            name: scenario.name,
            code: script,
            path: filePath,
            parameters: scenario.parameters,
            examplesName: scenario.examplesName,
        });
    }

    return generatedScripts;
}

/**
 * Generate a single k6 script for one resolved scenario.
 * @param {object} feature - Parent feature
 * @param {object} scenario - Resolved scenario
 * @returns {string} Complete k6 script as string
 */
function generateSingleScript(feature, scenario) {
    const collectedImports = new Set();
    const collectedMetrics = new Map();
    const collectedThresholds = {};
    const codeBlocks = [];
    let setupCode = null;

    // Process each step
    for (const step of scenario.steps) {
        const result = matchStep(step.text);

        if (!result) {
            // Unmatched step — add as comment
            codeBlocks.push({
                keyword: step.keyword,
                stepText: step.text,
                code: `    // [${step.keyword}] ${step.text} — Step no reconocido (sin definición)`
            });
            continue;
        }

        const { definition, match } = result;

        // Collect code
        codeBlocks.push({
            keyword: step.keyword,
            stepText: step.text,
            code: definition.code(match)
        });

        // Collect imports
        if (definition.imports) {
            definition.imports.forEach(imp => collectedImports.add(imp));
        }

        // Collect metrics
        if (definition.metrics) {
            definition.metrics.forEach(m => {
                collectedMetrics.set(m.name, m);
            });
        }

        // Collect thresholds
        if (definition.threshold) {
            const th = definition.threshold(match);
            if (!collectedThresholds[th.metric]) {
                collectedThresholds[th.metric] = [];
            }
            collectedThresholds[th.metric].push(th.rule);
        }

        // Collect setup code (use the last one found — most specific)
        if (definition.setup) {
            setupCode = definition.setup;
        }
    }

    // Build k6 options
    const k6Options = buildK6Options(scenario, collectedThresholds);

    // Build import statements
    const importStatements = buildImportStatements(collectedImports, collectedMetrics);

    // Build metrics declarations
    const metricsDeclarations = buildMetricsDeclarations(collectedMetrics);

    // Determine if we need `data` parameter in default function
    const needsData = setupCode !== null;
    const defaultParam = needsData ? 'data' : '';

    // Assembly the full script
    const parts = [];

    parts.push(`/**
 * K6 Performance Test — Auto-generated from BDD Feature
 * 
 * Feature: ${feature.name}
 * Scenario: ${scenario.name}
 * Examples: ${scenario.examplesName || 'N/A'}
 * Parameters: ${JSON.stringify(scenario.parameters || {})}
 * 
 * Generated at: ${new Date().toISOString()}
 * ⚠️  DO NOT EDIT — This file is auto-generated by the BDD runner.
 *     Edit the .feature file and step definitions instead.
 */`);

    parts.push('');
    parts.push(importStatements);
    parts.push('');

    if (metricsDeclarations) {
        parts.push('// ─────────────────────────────────────────────────────────────');
        parts.push('// CUSTOM METRICS');
        parts.push('// ─────────────────────────────────────────────────────────────');
        parts.push(metricsDeclarations);
        parts.push('');
    }

    parts.push('// ─────────────────────────────────────────────────────────────');
    parts.push('// OPTIONS');
    parts.push('// ─────────────────────────────────────────────────────────────');
    parts.push(`export const options = ${JSON.stringify(k6Options, null, 4)};`);
    parts.push('');

    if (setupCode) {
        parts.push('// ─────────────────────────────────────────────────────────────');
        parts.push('// SETUP');
        parts.push('// ─────────────────────────────────────────────────────────────');
        parts.push(`export function setup() {${setupCode}
}`);
        parts.push('');
    }

    parts.push('// ─────────────────────────────────────────────────────────────');
    parts.push(`// DEFAULT — ${scenario.name}`);
    parts.push('// ─────────────────────────────────────────────────────────────');
    parts.push(`export default function (${defaultParam}) {`);

    // Inject code blocks wrapped in groups
    for (const block of codeBlocks) {
        // Escape single quotes in step text for the group name
        const safeStepName = block.stepText.replace(/'/g, "\\'");
        parts.push(`    group('${block.keyword} ${safeStepName}', function () {`);
        // Indent the code inside the group
        const indentedCode = block.code.split('\n').map(line => `        ${line}`).join('\n');
        parts.push(indentedCode);
        parts.push(`    });`);
    }

    parts.push(`}`);
    parts.push('');

    parts.push('// ─────────────────────────────────────────────────────────────');
    parts.push('// TEARDOWN');
    parts.push('// ─────────────────────────────────────────────────────────────');
    parts.push(`export function teardown(${defaultParam}) {
    console.log('🏁 Test BDD completado: ${scenario.name.replace(/'/g, "\\'")}');
}`);
    parts.push('');

    parts.push('// ─────────────────────────────────────────────────────────────');
    parts.push('// REPORT');
    parts.push('// ─────────────────────────────────────────────────────────────');
    const reportName = scenario.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    parts.push(`export function handleSummary(data) {
    const ts = getTimestamp();
    return {
        [\`reports/bdd-${reportName}_\${ts}.html\`]: htmlReport(data),
        [\`reports/bdd-${reportName}_\${ts}.json\`]: JSON.stringify(data, null, 2),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    };
}`);

    return parts.join('\n');
}

/**
 * Build k6 options object from scenario parameters.
 */
function buildK6Options(scenario, thresholds) {
    const params = scenario.parameters || {};
    const vus = parseInt(params.vus) || 1;
    const stages = buildStages(params);

    const options = {};

    if (stages) {
        // Use ramping-vus executor
        options.scenarios = {};
        const scenarioKey = scenario.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 40);

        options.scenarios[scenarioKey] = {
            executor: 'ramping-vus',
            startVUs: Math.max(1, Math.floor(vus * 0.1)),
            stages: stages,
        };
    } else {
        // Simple iteration-based (smoke)
        options.vus = vus;
        options.iterations = parseInt(params.iterations) || 1;
    }

    // Add thresholds
    if (Object.keys(thresholds).length > 0) {
        options.thresholds = {};
        for (const [metric, rules] of Object.entries(thresholds)) {
            options.thresholds[metric] = rules;
        }
    }

    return options;
}

/**
 * Build import statements based on collected dependencies.
 */
function buildImportStatements(imports, metrics) {
    const lines = [];

    // Core k6 imports
    lines.push("import { sleep, group } from 'k6';");
    lines.push("import http from 'k6/http';");
    lines.push("import { check } from 'k6';");

    // k6/metrics
    const metricTypes = new Set();
    for (const m of metrics.values()) {
        metricTypes.add(m.type);
    }
    if (metricTypes.size > 0) {
        lines.push(`import { ${[...metricTypes].join(', ')} } from 'k6/metrics';`);
    }

    // Framework imports
    const libImports = {
        auth: [],
        endpoints: [],
        helpers: [],
        config: [],
    };

    const AUTH_EXPORTS = ['login', 'logout', 'getAuthHeaders'];
    const ENDPOINT_EXPORTS = ['getProducts', 'createProduct', 'updateProduct', 'getUsers', 'createUser', 'createOrder', 'getOrders'];
    const HELPER_EXPORTS = ['checkResponse', 'parseResponse', 'randomItem', 'randomInt', 'generateEmail', 'generateUserName', 'generateSku', 'generateProductName', 'randomThinkTime', 'getTimestamp'];
    const CONFIG_EXPORTS = ['BASE_URL', 'USERNAME', 'PASSWORD'];

    for (const imp of imports) {
        if (AUTH_EXPORTS.includes(imp)) libImports.auth.push(imp);
        else if (ENDPOINT_EXPORTS.includes(imp)) libImports.endpoints.push(imp);
        else if (HELPER_EXPORTS.includes(imp)) libImports.helpers.push(imp);
        else if (CONFIG_EXPORTS.includes(imp)) libImports.config.push(imp);
    }

    // Always import config BASE_URL (most tests need it)
    if (!libImports.config.includes('BASE_URL')) {
        libImports.config.push('BASE_URL');
    }

    // Always import getTimestamp for reports
    if (!libImports.helpers.includes('getTimestamp')) {
        libImports.helpers.push('getTimestamp');
    }

    if (libImports.config.length > 0) {
        lines.push(`import { ${libImports.config.join(', ')} } from '../../lib/config.js';`);
    }
    if (libImports.auth.length > 0) {
        lines.push(`import { ${libImports.auth.join(', ')} } from '../../lib/auth.js';`);
    }
    if (libImports.endpoints.length > 0) {
        lines.push(`import { ${libImports.endpoints.join(', ')} } from '../../lib/endpoints.js';`);
    }
    if (libImports.helpers.length > 0) {
        lines.push(`import { ${libImports.helpers.join(', ')} } from '../../lib/helpers.js';`);
    }

    // External report libraries
    lines.push("import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';");
    lines.push("import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';");

    return lines.join('\n');
}

/**
 * Build custom metric declarations.
 */
function buildMetricsDeclarations(metrics) {
    if (metrics.size === 0) return '';

    const lines = [];
    for (const m of metrics.values()) {
        if (m.type === 'Trend') {
            lines.push(`const ${m.name} = new Trend('${m.k6name}', ${m.isTime ? 'true' : 'false'});`);
        } else if (m.type === 'Rate') {
            lines.push(`const ${m.name} = new Rate('${m.k6name}');`);
        } else if (m.type === 'Counter') {
            lines.push(`const ${m.name} = new Counter('${m.k6name}');`);
        } else if (m.type === 'Gauge') {
            lines.push(`const ${m.name} = new Gauge('${m.k6name}');`);
        }
    }
    return lines.join('\n');
}
