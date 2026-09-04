import { describe, expect, it } from 'vitest';

import jsonUploadWorkflow from '../workflows/test-all-endpoints-json-upload.json';
import multipartUploadWorkflow from '../workflows/test-all-endpoints-multipart-upload.json';

interface WorkflowNode {
	name: string;
	type: string;
	parameters: Record<string, unknown>;
	onError?: string;
}

const liveWorkflowNodes = [
	...(jsonUploadWorkflow.nodes as WorkflowNode[]),
	...(multipartUploadWorkflow.nodes as WorkflowNode[]),
];

describe('live workflow output downloads', () => {
	it('uses existing processing branches as single and multiple output download canaries', () => {
		const downloadCanaries = liveWorkflowNodes.filter(
			(node) => node.type === 'CUSTOM.pdfRest' && node.parameters.downloadOutputFiles === true,
		);

		expect(downloadCanaries).toEqual([
			expect.objectContaining({
				name: 'Split a document',
				onError: 'continueErrorOutput',
				parameters: expect.objectContaining({
					operation: 'split',
					downloadOutputFiles: true,
					outputFileDataFieldName: 'splitPdf',
					options: expect.objectContaining({ pageRanges: ['1', '2-3'] }),
				}),
			}),
			expect.objectContaining({
				name: 'Compress PDF',
				onError: 'continueErrorOutput',
				parameters: expect.objectContaining({
					operation: 'compress',
					downloadOutputFiles: true,
					outputFileDataFieldName: 'compressedPdf',
				}),
			}),
			expect.objectContaining({
				name: 'Extract ZIP Archive',
				onError: 'continueErrorOutput',
				parameters: expect.objectContaining({
					operation: 'unzip',
					downloadOutputFiles: true,
					outputFileDataFieldName: 'unzippedFile',
				}),
			}),
		]);
	});

	it.each([
		['Split a document', ['splitPdf', 'splitPdf_1']],
		['Compress PDF', ['compressedPdf']],
		['Extract ZIP Archive', ['unzippedFile', 'unzippedFile_1']],
	])('validates downloaded binary metadata for %s', (nodeName, outputFields) => {
		const recorder = jsonUploadWorkflow.nodes.find(
			(node) => node.name === `Record ${nodeName} Result`,
		) as WorkflowNode | undefined;
		const expression = recorder?.parameters.jsonOutput as string | undefined;

		expect(expression).toEqual(expect.any(String));
		for (const outputField of outputFields) {
			expect(expression).toContain(`binary?.${outputField}?.data`);
			expect(expression).toContain(`${outputField}.fileName`);
			expect(expression).toContain(`${outputField}.mimeType === 'application/pdf'`);
		}
		expect(expression).toContain('OutputDownloadValidationError');
	});

	it.each(['Split a document', 'Compress PDF', 'Extract ZIP Archive'])(
		'routes %s download success and failure through its existing completion slot',
		(nodeName) => {
			expect(jsonUploadWorkflow.connections[nodeName]).toEqual({
				main: [
					[{ node: `Record ${nodeName} Result`, type: 'main', index: 0 }],
					[{ node: `Record ${nodeName} Result`, type: 'main', index: 0 }],
				],
			});
		},
	);
});
