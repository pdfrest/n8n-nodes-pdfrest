import { describe, expect, it } from 'vitest';

// These raw imports let the regression test inspect non-TypeScript CI files.
// @ts-expect-error Vitest provides raw-file imports through Vite.
import ciWorkflow from '../../.github/workflows/ci.yml?raw';
// @ts-expect-error Vitest provides raw-file imports through Vite.
import publishWorkflow from '../../.github/workflows/publish.yml?raw';
// @ts-expect-error Vitest provides raw-file imports through Vite.
import harness from '../../scripts/integration/run-live-tests.sh?raw';
// @ts-expect-error Vitest provides raw-file imports through Vite.
import summaryWriter from '../../scripts/integration/write-github-summary.mjs?raw';

const workflows = [
	['.github/workflows/ci.yml', ciWorkflow],
	['.github/workflows/publish.yml', publishWorkflow],
] as const;

describe('live workflow credential boundary', () => {
	for (const [workflowPath, workflow] of workflows) {
		it(`${workflowPath} pins every GitHub Action to a commit SHA`, () => {
			const references = [...workflow.matchAll(/^\s*uses:\s+([^\s#]+)/gm)].map(
				([, reference]) => reference,
			);

			expect(references.length).toBeGreaterThan(0);
			for (const reference of references) {
				expect(reference).toMatch(/^[^@]+@[0-9a-f]{40}$/);
			}
		});
	}

	for (const [workflowPath, workflow] of workflows) {
		it(`${workflowPath} installs tools before entering the credential-bearing step`, () => {
			const installStep = workflow.indexOf('Install live-test tools without credentials');
			const liveStep = workflow.indexOf('Run live endpoint workflows');
			const installBlock = workflow.slice(installStep, liveStep);

			expect(installStep).toBeGreaterThan(-1);
			expect(liveStep).toBeGreaterThan(installStep);
			expect(installBlock).toContain('npm install');
			expect(installBlock).toContain('n8n@$n8n_version');
			expect(installBlock).toContain('@n8n/cli@$n8n_cli_version');
			expect(workflow).toContain('run: bash scripts/integration/run-live-tests.sh');
			expect(workflow).not.toContain('run: npm run test:integration:live');
			expect(installBlock).not.toContain('PDFREST_API_KEY');
			expect(installBlock).not.toContain('secrets.');
		});
	}

	for (const [workflowPath, workflow] of workflows) {
		it(`${workflowPath} uploads only the sanitized diagnostics file`, () => {
			expect(workflow).toContain(
				'--artifact-output "$RUNNER_TEMP/pdfrest-sanitized-diagnostics/diagnostics.json"',
			);
			expect(workflow).toContain(
				'path: ${{ runner.temp }}/pdfrest-sanitized-diagnostics/diagnostics.json',
			);
			expect(workflow).not.toMatch(
				/^\s*path:\s*\$\{\{ runner\.temp \}\}\/pdfrest-diagnostics\s*$/m,
			);
		});
	}

	it('uses preinstalled tools in CI and removes the credential from local installation', () => {
		expect(harness).toContain('if [[ -z "${PDFREST_LIVE_TOOLS_DIR:-}" ]]');
		expect(harness).toContain('env -u PDFREST_API_KEY npm install');
	});

	it('keeps raw live-test logs out of the Actions output', () => {
		expect(harness).not.toMatch(/tail\s+-n\s+\d+/);
		expect(harness).toContain('>"$execution_log" 2>&1');
		expect(harness).toContain(
			"echo 'Live integration tests failed; raw output will not be published'",
		);
		expect(summaryWriter).not.toMatch(/console\.(?:debug|error|info|log|warn)/);
	});
});
