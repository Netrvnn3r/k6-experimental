#!/usr/bin/env node

/**
 * BDD Runner — CLI for K6 + Cucumber/Gherkin Integration
 * 
 * Usage:
 *   node bdd/runner.js [feature-file|features-dir] [options]
 * 
 * Options:
 *   --parse-only      Only parse and print the JSON structure (no generation/execution)
 *   --generate-only   Parse and generate k6 scripts, but don't execute them
 *   --env KEY=VALUE   Pass environment variables to k6 (can be repeated)
 *   --output-dir DIR  Custom output directory for generated scripts (default: tests/generated)
 * 
 * Examples:
 *   node bdd/runner.js features/smoke-test.feature
 *   node bdd/runner.js features/                       # Run all features
 *   node bdd/runner.js features/auth-flow.feature --parse-only
 *   node bdd/runner.js features/smoke-test.feature --generate-only
 *   node bdd/runner.js features/ --env BASE_URL=https://example.com
 */

import { parseFeatureFile, parseAllFeatures } from './parser.js';
import { generateK6Scripts } from './generator.js';
import { getAllStepDefinitions } from './steps/index.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                K6 BDD Runner — Gherkin → K6                 ║
║                                                              ║
║  Transform .feature files into k6 performance test scripts   ║
╚══════════════════════════════════════════════════════════════╝

Usage:
  node bdd/runner.js <feature-file|features-dir> [options]

Options:
  --parse-only      Only parse and print the JSON structure
  --generate-only   Parse and generate k6 scripts, don't execute
  --env KEY=VALUE   Pass environment variables to k6
  --output-dir DIR  Output directory (default: tests/generated)
  --list-steps      List all available step definitions
  --help            Show this help message

Examples:
  node bdd/runner.js features/smoke-test.feature
  node bdd/runner.js features/
  node bdd/runner.js features/auth-flow.feature --parse-only
  node bdd/runner.js features/ --env BASE_URL=https://example.com
`);
    process.exit(0);
}

// Handle --list-steps
if (args.includes('--list-steps')) {
    console.log('\n📋 Step Definitions Disponibles:\n');
    const steps = getAllStepDefinitions();
    steps.forEach((step, i) => {
        console.log(`  ${i + 1}. /${step.pattern}/`);
        if (step.hasSetup) console.log('     ↪ Incluye setup()');
        if (step.hasThreshold) console.log('     ↪ Define thresholds');
        if (step.imports.length > 0) console.log(`     ↪ Imports: ${step.imports.join(', ')}`);
    });
    console.log(`\n  Total: ${steps.length} step definitions\n`);
    process.exit(0);
}

// Parse options
const parseOnly = args.includes('--parse-only');
const generateOnly = args.includes('--generate-only');
const envVars = [];
const outputDirIdx = args.indexOf('--output-dir');
let outputDir = path.resolve('tests/generated');

if (outputDirIdx !== -1 && args[outputDirIdx + 1]) {
    outputDir = path.resolve(args[outputDirIdx + 1]);
}

// Collect --env arguments
args.forEach((arg, i) => {
    if (arg === '--env' && args[i + 1]) {
        envVars.push(args[i + 1]);
    }
});

// Get the target (feature file or directory)
const target = args.find(a => !a.startsWith('--') && (a.endsWith('.feature') || !a.includes('=')));

if (!target) {
    console.error('❌ Error: No feature file or directory specified.');
    process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Main Execution
// ─────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║              🥒 K6 BDD Runner — Gherkin → K6              ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

try {
    // Step 1: Parse
    console.log('📖 Fase 1: Parseando archivos .feature...\n');

    let features;
    const resolvedTarget = path.resolve(target);

    if (fs.statSync(resolvedTarget).isDirectory()) {
        features = parseAllFeatures(resolvedTarget);
    } else {
        features = [parseFeatureFile(resolvedTarget)];
    }

    // Summary of parsed features
    let totalScenarios = 0;
    for (const feature of features) {
        console.log(`  ✅ Feature: "${feature.name}" — ${feature.scenarios.length} scenario(s)`);
        for (const sc of feature.scenarios) {
            console.log(`     └─ ${sc.name}`);
            if (sc.parameters && Object.keys(sc.parameters).length > 0) {
                console.log(`        Params: ${JSON.stringify(sc.parameters)}`);
            }
        }
        totalScenarios += feature.scenarios.length;
    }
    console.log(`\n  📊 Total: ${features.length} feature(s), ${totalScenarios} scenario(s)\n`);

    // If parse-only, print JSON and exit
    if (parseOnly) {
        console.log('─────────────────────────────────────────────────────────────');
        console.log('📋 Parsed Feature Data (JSON):\n');
        console.log(JSON.stringify(features, null, 2));
        process.exit(0);
    }

    // Step 2: Generate k6 scripts
    console.log('⚙️  Fase 2: Generando scripts k6...\n');

    const allGenerated = [];
    for (const feature of features) {
        const generated = generateK6Scripts(feature, { outputDir });
        allGenerated.push(...generated);

        for (const script of generated) {
            console.log(`  ✅ Generated: ${path.basename(script.path)}`);
            console.log(`     └─ ${script.path}`);
        }
    }

    console.log(`\n  📊 Total scripts generados: ${allGenerated.length}\n`);

    // If generate-only, stop here
    if (generateOnly) {
        console.log('✅ Generación completada. Scripts en:', outputDir);
        process.exit(0);
    }

    // Step 3: Execute with k6
    console.log('🚀 Fase 3: Ejecutando tests con k6...\n');

    // Build env string for k6
    const defaultEnvs = [
        'BASE_URL=https://perfappdemo.vercel.app',
        'USERNAME=ghauyon',
        'PASSWORD=user4Test',
    ];
    const allEnvs = [...defaultEnvs, ...envVars];
    const envString = allEnvs.map(e => `-e ${e}`).join(' ');

    let allPassed = true;
    const results = [];

    for (const script of allGenerated) {
        console.log(`  🏃 Running: ${script.name}`);
        console.log(`     Script: ${script.path}`);

        const cmd = `k6 run ${envString} "${script.path}"`;
        console.log(`     Command: ${cmd}\n`);

        try {
            const output = execSync(cmd, {
                cwd: path.resolve('.'),
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 600000, // 10 min max per test
            });

            console.log(output);
            results.push({ name: script.name, status: 'PASS', output });
            console.log(`  ✅ PASS: ${script.name}\n`);
        } catch (execError) {
            allPassed = false;
            const errorOutput = execError.stdout || execError.stderr || execError.message;
            console.error(errorOutput);
            results.push({ name: script.name, status: 'FAIL', output: errorOutput });
            console.error(`  ❌ FAIL: ${script.name}\n`);
        }
    }

    // Final Summary
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 RESUMEN FINAL                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : '❌';
        console.log(`  ${icon} ${r.name}: ${r.status}`);
    }

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`\n  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}\n`);

    process.exit(allPassed ? 0 : 1);

} catch (error) {
    console.error(`\n❌ Error fatal: ${error.message}\n`);
    if (error.stack) {
        console.error(error.stack);
    }
    process.exit(1);
}
