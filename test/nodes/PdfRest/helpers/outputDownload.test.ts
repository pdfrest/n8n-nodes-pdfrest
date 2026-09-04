import type {
	IBinaryData,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import {
	createOperationOutputDownloadFields,
	downloadOutputFiles,
} from '../../../../nodes/PdfRest/helpers/outputDownload';

interface ContextOptions {
	downloadOutputFiles?: boolean;
	operation?: string;
	outputFileDataFieldName?: string;
	responses?: IN8nHttpFullResponse[];
}

function createContext({
	downloadOutputFiles: shouldDownload,
	operation = 'compress',
	outputFileDataFieldName = 'data',
	responses = [],
}: ContextOptions = {}) {
	const requests: IHttpRequestOptions[] = [];
	const prepareBinaryData = vi.fn(
		async (body: Buffer, fileName?: string, mimeType?: string): Promise<IBinaryData> => ({
			data: body.toString('base64'),
			mimeType: mimeType ?? 'application/octet-stream',
			fileName,
		}),
	);
	const parameters: Record<string, unknown> = {
		operation,
		downloadOutputFiles: shouldDownload,
		outputFileDataFieldName,
	};
	const context = {
		getCredentials: async (name: string) => {
			expect(name).toBe('pdfRestApi');
			return { baseUrl: 'https://api.pdfrest.com/' };
		},
		getNode: () => ({ name: 'pdfRest' }),
		getNodeParameter: (name: string, fallbackValue?: unknown) => parameters[name] ?? fallbackValue,
		helpers: {
			httpRequestWithAuthentication: async (
				credentialType: string,
				requestOptions: IHttpRequestOptions,
			) => {
				expect(credentialType).toBe('pdfRestApi');
				requests.push(requestOptions);
				const response = responses[requests.length - 1];
				if (!response) throw new Error('Missing mocked download response');
				return response;
			},
			prepareBinaryData,
		},
	} as unknown as IExecuteSingleFunctions;

	return { context, prepareBinaryData, requests };
}

function createFileResponse(
	contents: string,
	fileName: string,
	mimeType = 'application/pdf',
): IN8nHttpFullResponse {
	return {
		body: Buffer.from(contents),
		headers: {
			'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
			'content-type': `${mimeType}; charset=binary`,
		},
		statusCode: 200,
	};
}

describe('output downloads', () => {
	it('defines disabled-by-default controls for single and multiple output files', () => {
		const single = createOperationOutputDownloadFields('compress');
		const multiple = createOperationOutputDownloadFields('split');
		const fileOutput = createOperationOutputDownloadFields('convertMarkdown');

		expect(single).toMatchObject([
			{
				displayName: 'Download Output Files',
				name: 'downloadOutputFiles',
				type: 'boolean',
				default: false,
				description: expect.stringMatching(/^Whether to/),
			},
			{
				displayName: 'Output File Data Field Name',
				name: 'outputFileDataFieldName',
				type: 'string',
				default: 'data',
			},
		]);
		expect(multiple[1]).toMatchObject({
			displayName: 'Output File Data Field Name Prefix',
		});
		expect(fileOutput[1].displayOptions).toEqual({ show: { outputType: ['file'] } });
		expect(createOperationOutputDownloadFields('getRequestStatus')).toEqual([]);
	});

	it('downloads one or more output IDs into distinct fields while preserving JSON', async () => {
		const { context, prepareBinaryData, requests } = createContext({
			downloadOutputFiles: true,
			operation: 'split',
			outputFileDataFieldName: 'document',
			responses: [
				createFileResponse('first file', 'split 1.pdf'),
				createFileResponse('second file', 'split 2.pdf'),
			],
		});
		const json = {
			outputId: ['first resource', 'second-resource'],
			inputId: 'input-resource',
		};
		const items: INodeExecutionData[] = [{ json }];

		const result = await downloadOutputFiles.call(context, items, {
			body: json,
			headers: { 'content-type': 'application/json' },
			statusCode: 200,
		});

		expect(result[0].json).toBe(json);
		expect(Object.keys(result[0].binary ?? {})).toEqual(['document', 'document_1']);
		expect(result[0].binary?.document).toMatchObject({
			fileName: 'split 1.pdf',
			mimeType: 'application/pdf',
			directory: 'https://api.pdfrest.com/resource/first%20resource?format=file',
		});
		expect(result[0].binary?.document_1).toMatchObject({
			fileName: 'split 2.pdf',
			directory: 'https://api.pdfrest.com/resource/second-resource?format=file',
		});
		expect(requests).toEqual([
			{
				method: 'GET',
				url: 'https://api.pdfrest.com/resource/first%20resource?format=file',
				headers: { Accept: '*/*' },
				encoding: 'arraybuffer',
				returnFullResponse: true,
			},
			{
				method: 'GET',
				url: 'https://api.pdfrest.com/resource/second-resource?format=file',
				headers: { Accept: '*/*' },
				encoding: 'arraybuffer',
				returnFullResponse: true,
			},
		]);
		expect(prepareBinaryData).toHaveBeenNthCalledWith(
			1,
			Buffer.from('first file'),
			'split 1.pdf',
			'application/pdf',
		);
	});

	it('downloads every file reference returned by Unzip', async () => {
		const { context } = createContext({
			downloadOutputFiles: true,
			operation: 'unzip',
			responses: [
				createFileResponse('first', 'first.txt', 'text/plain'),
				createFileResponse('second', 'second.csv', 'text/csv'),
			],
		});
		const items: INodeExecutionData[] = [
			{
				json: {
					files: [
						{ id: 'first-id', name: 'first.txt' },
						{ id: 'second-id', name: 'second.csv' },
					],
					inputId: 'archive-id',
				},
			},
		];

		const result = await downloadOutputFiles.call(context, items, {
			body: items[0].json,
			headers: { 'content-type': 'application/json' },
			statusCode: 200,
		});

		expect(result[0].binary?.data.fileName).toBe('first.txt');
		expect(result[0].binary?.data_1.fileName).toBe('second.csv');
	});

	it('passes disabled, inline JSON, and asynchronous responses through unchanged', async () => {
		const disabled = createContext();
		const completedItems: INodeExecutionData[] = [{ json: { outputId: 'output-id' } }];
		expect(
			await downloadOutputFiles.call(disabled.context, completedItems, {} as IN8nHttpFullResponse),
		).toBe(completedItems);
		expect(disabled.requests).toHaveLength(0);

		for (const json of [
			{ summary: 'Inline response', inputId: 'input-id' },
			{ requestId: 'request-id', message: 'Accepted' },
			{ warning: 'No output was produced' },
		]) {
			const enabled = createContext({ downloadOutputFiles: true });
			const items: INodeExecutionData[] = [{ json }];
			expect(
				await downloadOutputFiles.call(enabled.context, items, {} as IN8nHttpFullResponse),
			).toBe(items);
			expect(enabled.requests).toHaveLength(0);
		}
	});

	it('does not download completed Request Status responses', async () => {
		const { context, requests } = createContext({
			downloadOutputFiles: true,
			operation: 'getRequestStatus',
		});
		const items: INodeExecutionData[] = [
			{ json: { status: 'completed', requestId: 'request-id', outputId: 'output-id' } },
		];

		expect(await downloadOutputFiles.call(context, items, {} as IN8nHttpFullResponse)).toBe(items);
		expect(requests).toHaveLength(0);
	});

	it('rejects blank or conflicting output field names before overwriting data', async () => {
		const response = createFileResponse('file', 'output.pdf');
		const blank = createContext({
			downloadOutputFiles: true,
			outputFileDataFieldName: ' ',
			responses: [response],
		});
		await expect(
			downloadOutputFiles.call(
				blank.context,
				[{ json: { outputId: 'output-id' } }],
				{} as IN8nHttpFullResponse,
			),
		).rejects.toThrow('Output File Data Field Name must not be empty');

		const conflicting = createContext({ downloadOutputFiles: true, responses: [response] });
		await expect(
			downloadOutputFiles.call(
				conflicting.context,
				[
					{
						json: { outputId: 'output-id' },
						binary: {
							data: { data: 'existing', mimeType: 'application/pdf' },
						},
					},
				],
				{} as IN8nHttpFullResponse,
			),
		).rejects.toThrow('The output file data field "data" already exists');
	});
});
