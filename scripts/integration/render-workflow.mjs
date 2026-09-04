#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const ALLOWED_WORKFLOW_KEYS = [
	'connections',
	'name',
	'nodeGroups',
	'nodes',
	'pinData',
	'settings',
	'staticData',
];

export const DEFAULT_FIXTURE_URLS = {
	pdf: 'https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf',
	redactionPdf: 'https://permanentredaction.com/examples/legal/sworn_declaration_Original.pdf',
	image:
		'https://images.pdimagearchive.org/collections/ogawa-kazumasa-s-hand-coloured-photographs-of-flowers-1896/32425996707_b4df7f8fd4_c.jpg?width=612&height=800',
};

const FIXTURE_ROOT = 'test/fixtures';

function assertSanitizedWorkflow(workflow) {
	const keys = Object.keys(workflow).sort();
	if (JSON.stringify(keys) !== JSON.stringify(ALLOWED_WORKFLOW_KEYS)) {
		throw new Error(
			`Workflow must contain exactly these top-level keys: ${ALLOWED_WORKFLOW_KEYS.join(', ')}`,
		);
	}
}

function replaceStringValues(value, replacements, counts) {
	if (typeof value === 'string') {
		for (const [source, destination] of replacements) {
			if (value === source) {
				counts.set(source, (counts.get(source) ?? 0) + 1);
				return destination;
			}
		}
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => replaceStringValues(entry, replacements, counts));
	}

	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				replaceStringValues(entry, replacements, counts),
			]),
		);
	}

	return value;
}

function collectHttpUrls(value, urls = new Set()) {
	if (typeof value === 'string') {
		if (/^https?:\/\//u.test(value)) urls.add(value);
		return urls;
	}

	if (Array.isArray(value)) {
		for (const entry of value) collectHttpUrls(entry, urls);
		return urls;
	}

	if (value !== null && typeof value === 'object') {
		for (const entry of Object.values(value)) collectHttpUrls(entry, urls);
	}

	return urls;
}

export function renderWorkflow(workflow, configuration) {
	assertSanitizedWorkflow(workflow);

	const rendered = structuredClone(workflow);
	let credentialReferences = 0;
	let diagnosticNodes = 0;
	let fileSelectors = 0;

	for (const node of rendered.nodes) {
		const credential = node.credentials?.pdfRestApi;
		if (credential) {
			credential.id = configuration.credentialId;
			credential.name = configuration.credentialName;
			credentialReferences += 1;
			node.parameters.requestDiagnostics = true;
			diagnosticNodes += 1;
		}

		const selector = node.parameters?.fileSelector;
		if (typeof selector !== 'string') continue;

		const isFixtureSelector = selector === FIXTURE_ROOT || selector.startsWith(`${FIXTURE_ROOT}/`);
		if (!isFixtureSelector) {
			if (node.type === 'n8n-nodes-base.readWriteFile') {
				throw new Error(`Unexpected fixture selector on ${node.name}: ${selector}`);
			}
			continue;
		}

		node.parameters.fileSelector = `${configuration.fixtureDirectory}${selector.slice(FIXTURE_ROOT.length)}`;
		fileSelectors += 1;
	}

	if (credentialReferences === 0) {
		throw new Error('Workflow does not contain any pdfRest credential references');
	}

	const urlReplacements = new Map([
		[DEFAULT_FIXTURE_URLS.pdf, configuration.pdfUrl],
		[DEFAULT_FIXTURE_URLS.redactionPdf, configuration.redactionPdfUrl],
		[DEFAULT_FIXTURE_URLS.image, configuration.imageUrl],
	]);
	const unexpectedUrls = [...collectHttpUrls(rendered)].filter((url) => !urlReplacements.has(url));
	if (unexpectedUrls.length > 0) {
		throw new Error(`Unexpected fixture URL(s): ${unexpectedUrls.join(', ')}`);
	}

	const urlCounts = new Map();
	const workflowWithUrls = replaceStringValues(rendered, urlReplacements, urlCounts);
	return {
		workflow: workflowWithUrls,
		replacements: {
			credentialReferences,
			diagnosticNodes,
			fileSelectors,
			fixtureUrls: Object.fromEntries(
				[...urlReplacements.keys()].map((source) => [source, urlCounts.get(source) ?? 0]),
			),
		},
	};
}

function requiredEnvironmentValue(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} must be set`);
	return value;
}

async function main() {
	const { values } = parseArgs({
		options: {
			input: { type: 'string' },
			output: { type: 'string' },
		},
	});

	if (!values.input || !values.output) {
		throw new Error('Usage: render-workflow.mjs --input <workflow.json> --output <workflow.json>');
	}

	const inputPath = resolve(values.input);
	const outputPath = resolve(values.output);
	const source = JSON.parse(await readFile(inputPath, 'utf8'));
	const result = renderWorkflow(source, {
		credentialId: requiredEnvironmentValue('PDFREST_CREDENTIAL_ID'),
		credentialName: process.env.PDFREST_CREDENTIAL_NAME || 'pdfRest CI',
		fixtureDirectory: resolve(requiredEnvironmentValue('PDFREST_TEST_FIXTURE_DIR')),
		pdfUrl: process.env.PDFREST_TEST_PDF_URL || DEFAULT_FIXTURE_URLS.pdf,
		redactionPdfUrl:
			process.env.PDFREST_TEST_REDACTION_PDF_URL || DEFAULT_FIXTURE_URLS.redactionPdf,
		imageUrl: process.env.PDFREST_TEST_IMAGE_URL || DEFAULT_FIXTURE_URLS.image,
	});

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(result.workflow, null, '\t')}\n`, { mode: 0o600 });
	process.stdout.write(`${JSON.stringify(result.replacements)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	main().catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	});
}
