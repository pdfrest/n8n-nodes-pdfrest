import { describe, expect, it } from 'vitest';

// The integration helper is plain ESM so CI can execute it without a build step.
// @ts-expect-error The JavaScript helper intentionally does not publish TypeScript declarations.
import {
	DEFAULT_FIXTURE_URLS,
	renderWorkflow,
} from '../../scripts/integration/render-workflow.mjs';

function workflowFixture() {
	return {
		name: 'Integration workflow',
		nodes: [
			{
				name: 'Read fixture',
				type: 'n8n-nodes-base.readWriteFile',
				parameters: { fileSelector: 'test/fixtures/forms/*' },
			},
			{
				name: 'Call pdfRest',
				type: 'CUSTOM.pdfRest',
				parameters: { urls: [DEFAULT_FIXTURE_URLS.pdf, DEFAULT_FIXTURE_URLS.image] },
				credentials: { pdfRestApi: { id: 'old-id', name: 'old-name' } },
			},
		],
		connections: {},
		settings: {},
		staticData: null,
		nodeGroups: [],
		pinData: {},
	};
}

describe('renderWorkflow', () => {
	it('replaces paths, URLs, and credential references without mutating the source', () => {
		const source = workflowFixture();
		const result = renderWorkflow(source, {
			credentialId: 'ci-credential-id',
			credentialName: 'pdfRest CI',
			fixtureDirectory: '/tmp/pdfrest-fixtures',
			pdfUrl: 'https://fixtures.example/sample.pdf',
			redactionPdfUrl: 'https://fixtures.example/redaction.pdf',
			imageUrl: 'https://fixtures.example/flower.jpg',
		});

		expect(result.workflow.nodes[0].parameters.fileSelector).toBe('/tmp/pdfrest-fixtures/forms/*');
		expect(result.workflow.nodes[1].parameters.urls).toEqual([
			'https://fixtures.example/sample.pdf',
			'https://fixtures.example/flower.jpg',
		]);
		expect(result.workflow.nodes[1].credentials.pdfRestApi).toEqual({
			id: 'ci-credential-id',
			name: 'pdfRest CI',
		});
		expect(result.workflow.nodes[1].parameters.requestDiagnostics).toBe(true);
		expect(result.replacements).toMatchObject({
			credentialReferences: 1,
			diagnosticNodes: 1,
			fileSelectors: 1,
		});
		expect(source.nodes[0].parameters.fileSelector).toBe('test/fixtures/forms/*');
		expect(source.nodes[1].credentials.pdfRestApi.id).toBe('old-id');
		expect(source.nodes[1].parameters.requestDiagnostics).toBeUndefined();
	});

	it('rejects workflow API response metadata', () => {
		const source = { ...workflowFixture(), id: 'server-owned-id' };
		expect(() =>
			renderWorkflow(source, {
				credentialId: 'ci-credential-id',
				credentialName: 'pdfRest CI',
				fixtureDirectory: '/tmp/pdfrest-fixtures',
				pdfUrl: DEFAULT_FIXTURE_URLS.pdf,
				redactionPdfUrl: DEFAULT_FIXTURE_URLS.redactionPdf,
				imageUrl: DEFAULT_FIXTURE_URLS.image,
			}),
		).toThrow('Workflow must contain exactly these top-level keys');
	});

	it('rejects unconfigured remote fixtures', () => {
		const source = workflowFixture();
		source.nodes[1].parameters.urls.push('https://fixtures.example/unconfigured.pdf');

		expect(() =>
			renderWorkflow(source, {
				credentialId: 'ci-credential-id',
				credentialName: 'pdfRest CI',
				fixtureDirectory: '/tmp/pdfrest-fixtures',
				pdfUrl: DEFAULT_FIXTURE_URLS.pdf,
				redactionPdfUrl: DEFAULT_FIXTURE_URLS.redactionPdf,
				imageUrl: DEFAULT_FIXTURE_URLS.image,
			}),
		).toThrow('Unexpected fixture URL');
	});
});
