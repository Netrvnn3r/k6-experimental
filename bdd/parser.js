/**
 * BDD Gherkin Parser Module
 * 
 * Parses .feature files using @cucumber/gherkin and @cucumber/messages.
 * Extracts Features, Scenario Outlines, Steps, and Examples tables.
 * Resolves <placeholder> parameters with values from each Examples row.
 * 
 * Returns a normalized JSON structure ready for the generator.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Gherkin = require('@cucumber/gherkin');
const Messages = require('@cucumber/messages');
import fs from 'fs';
import path from 'path';


/**
 * Parse a single .feature file and return structured data.
 * @param {string} featurePath - Absolute or relative path to the .feature file
 * @returns {object} Parsed feature with resolved scenarios
 */
export function parseFeatureFile(featurePath) {
    const absolutePath = path.resolve(featurePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Feature file not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');

    // Use the Gherkin parser to create an AST
    const uuidFn = Messages.IdGenerator.uuid();
    const builder = new Gherkin.AstBuilder(uuidFn);
    const matcher = new Gherkin.GherkinClassicTokenMatcher();
    const parser = new Gherkin.Parser(builder, matcher);

    let gherkinDocument;
    try {
        gherkinDocument = parser.parse(content);
    } catch (err) {
        throw new Error(`Failed to parse feature file ${absolutePath}: ${err.message}`);
    }

    const feature = gherkinDocument.feature;
    if (!feature) {
        throw new Error(`No Feature found in ${absolutePath}`);
    }

    const result = {
        name: feature.name,
        description: (feature.description || '').trim(),
        tags: (feature.tags || []).map(t => t.name),
        file: absolutePath,
        scenarios: [],
    };

    for (const child of feature.children) {
        if (child.scenario) {
            const scenario = child.scenario;

            // Check if it's a Scenario Outline (has examples)
            if (scenario.examples && scenario.examples.length > 0) {
                // It's a Scenario Outline — resolve with each Examples table
                const resolvedScenarios = resolveScenarioOutline(scenario);
                result.scenarios.push(...resolvedScenarios);
            } else {
                // Regular Scenario (no Examples)
                result.scenarios.push({
                    name: scenario.name,
                    tags: (scenario.tags || []).map(t => t.name),
                    type: 'scenario',
                    examplesName: null,
                    parameters: {},
                    steps: scenario.steps.map(step => ({
                        keyword: step.keyword.trim(),
                        text: step.text,
                        dataTable: step.dataTable ? parseDataTable(step.dataTable) : null,
                        docString: step.docString ? step.docString.content : null,
                    })),
                });
            }
        }

        // Handle Background
        if (child.background) {
            result.background = {
                name: child.background.name,
                steps: child.background.steps.map(step => ({
                    keyword: step.keyword.trim(),
                    text: step.text,
                    dataTable: step.dataTable ? parseDataTable(step.dataTable) : null,
                    docString: step.docString ? step.docString.content : null,
                })),
            };
        }
    }

    return result;
}

/**
 * Resolve a Scenario Outline into concrete scenarios using Examples tables.
 * Each row in each Examples table generates one concrete scenario.
 * @param {object} scenario - The Gherkin scenario AST node
 * @returns {Array} Array of resolved scenario objects
 */
function resolveScenarioOutline(scenario) {
    const resolved = [];

    for (const examples of scenario.examples) {
        if (!examples.tableHeader || !examples.tableBody || examples.tableBody.length === 0) {
            continue;
        }

        const headers = examples.tableHeader.cells.map(c => c.value);
        const examplesName = examples.name || 'Default';
        const examplesTags = (examples.tags || []).map(t => t.name);

        for (let rowIndex = 0; rowIndex < examples.tableBody.length; rowIndex++) {
            const row = examples.tableBody[rowIndex];
            const values = row.cells.map(c => c.value);

            // Build parameter map for this row
            const params = {};
            headers.forEach((header, i) => {
                params[header] = values[i] || '';
            });

            // Replace <placeholders> in step texts
            const resolvedSteps = scenario.steps.map(step => {
                let resolvedText = step.text;
                for (const [key, val] of Object.entries(params)) {
                    resolvedText = resolvedText.replace(new RegExp(`<${key}>`, 'g'), val);
                }
                return {
                    keyword: step.keyword.trim(),
                    text: resolvedText,
                    dataTable: step.dataTable ? parseDataTable(step.dataTable) : null,
                    docString: step.docString ? step.docString.content : null,
                };
            });

            // Generate a unique name for this resolved scenario
            const scenarioName = `${scenario.name} [${examplesName} — Row ${rowIndex + 1}]`;

            resolved.push({
                name: scenarioName,
                tags: [
                    ...(scenario.tags || []).map(t => t.name),
                    ...examplesTags,
                ],
                type: 'scenario_outline',
                examplesName,
                parameters: params,
                steps: resolvedSteps,
            });
        }
    }

    return resolved;
}

/**
 * Parse a Gherkin DataTable into a simple 2D array.
 * @param {object} dataTable - Gherkin DataTable AST node
 * @returns {Array<Array<string>>} 2D array of cell values
 */
function parseDataTable(dataTable) {
    return dataTable.rows.map(row => row.cells.map(cell => cell.value));
}

/**
 * Parse all .feature files in a directory.
 * @param {string} dirPath - Path to directory containing .feature files
 * @returns {Array} Array of parsed feature objects
 */
export function parseAllFeatures(dirPath) {
    const absoluteDir = path.resolve(dirPath);

    if (!fs.existsSync(absoluteDir)) {
        throw new Error(`Features directory not found: ${absoluteDir}`);
    }

    const files = fs.readdirSync(absoluteDir)
        .filter(f => f.endsWith('.feature'))
        .sort();

    if (files.length === 0) {
        throw new Error(`No .feature files found in ${absoluteDir}`);
    }

    return files.map(file => {
        const fullPath = path.join(absoluteDir, file);
        console.log(`📄 Parsing: ${file}`);
        return parseFeatureFile(fullPath);
    });
}
