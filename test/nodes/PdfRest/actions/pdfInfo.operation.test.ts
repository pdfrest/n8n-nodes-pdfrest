import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	pdfInfoDescription,
	pdfInfoOperation,
} from '../../../../nodes/PdfRest/actions/pdfInfo.operation';

const expectedIndividualQueries = [
	'author',
	'contains_acroforms',
	'contains_annotations',
	'contains_embedded_file',
	'contains_javascript',
	'contains_signature',
	'contains_transparency',
	'contains_xfa',
	'creation_date',
	'creator',
	'custom_metadata',
	'doc_language',
	'file_size',
	'filename',
	'image_only',
	'keywords',
	'modified_date',
	'page_boxes',
	'page_count',
	'pdfa',
	'pdfe_claim',
	'pdfua_claim',
	'pdf_version',
	'pdfvt_claim',
	'pdfx_claim',
	'producer',
	'requires_password_to_open',
	'restrict_permissions_set',
	'subject',
	'tagged',
	'title',
	'uses_embedded_fonts',
	'uses_nonembedded_fonts',
];

describe('Query PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(pdfInfoOperation).toMatchObject({
			name: 'Query PDF Metadata and Document Properties',
			value: 'pdfInfo',
			action: 'Extract · Query PDF Info (Metadata)',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-info',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires a resource ID and routes it to the exact id body property', () => {
		const resourceId = pdfInfoDescription.find((field) => field.name === 'resourceId');

		expect(resourceId).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['pdfInfo'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('defaults required queries to the mutually exclusive all branch', () => {
		const queries = pdfInfoDescription.find((field) => field.name === 'queries');

		expect(queries).toMatchObject({
			displayName: 'Queries',
			type: 'options',
			options: [
				{ name: 'All Queries', value: 'all' },
				{ name: 'Select Queries', value: 'selected' },
			],
			default: 'all',
			required: true,
			displayOptions: { show: { operation: ['pdfInfo'] } },
			routing: {
				send: {
					type: 'body',
					property: 'queries',
					value:
						"={{ $value === 'all' ? 'all' : $parameter.selectedQueries.join(',') }}",
				},
			},
		});
	});

	it('exposes every individual query and the declared example only in the selected branch', () => {
		const selectedQueries = pdfInfoDescription.find(
			(field) => field.name === 'selectedQueries',
		);

		expect(selectedQueries).toMatchObject({
			displayName: 'Selected Queries',
			type: 'multiOptions',
			default: ['tagged', 'image_only', 'creation_date', 'modified_date', 'doc_language'],
			required: true,
			displayOptions: {
				show: {
					operation: ['pdfInfo'],
					queries: ['selected'],
				},
			},
		});
		expect(selectedQueries?.options?.map((option) => option.value)).toEqual(
			expectedIndividualQueries,
		);
		expect(selectedQueries?.options?.map((option) => option.value)).not.toContain('all');
		expect(selectedQueries?.routing).toBeUndefined();
	});

	it('places both declared optional headers in alphabetical order', () => {
		const optionalFields = pdfInfoDescription.find((field) => field.name === 'options');

		expect(optionalFields).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['pdfInfo'] } },
		});
		expect(optionalFields?.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'responseType',
		]);
	});

	it('sends Include-File-Info with its false OpenAPI default', async () => {
		const optionalFields = pdfInfoDescription.find((field) => field.name === 'options');
		const includeFileInfo = optionalFields?.options?.find(
			(field) => field.name === 'includeFileInfo',
		);
		const request: IHttpRequestOptions = { url: '/pdf-info' };

		expect(includeFileInfo).toMatchObject({
			type: 'boolean',
			default: false,
			routing: { send: {} },
		});
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.includeFileInfo');
					return false;
				},
			} as unknown as IExecuteSingleFunctions,
			request,
		);
		expect(request.headers).toEqual({ 'Include-File-Info': false });
	});

	it('omits Response-Type by default and supports the request ID branch', async () => {
		const optionalFields = pdfInfoDescription.find((field) => field.name === 'options');
		const responseType = optionalFields?.options?.find((field) => field.name === 'responseType');
		const preSend = responseType?.routing?.send?.preSend?.[0];

		expect(responseType).toMatchObject({
			type: 'options',
			default: '',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			routing: { send: {} },
		});

		const synchronousRequest: IHttpRequestOptions = {
			url: '/pdf-info',
			headers: { 'Content-Type': 'application/json', 'Response-Type': '' },
		};
		await preSend?.call(
			{
				getNodeParameter: (name: string) => {
					expect(name).toBe('options.responseType');
					return '';
				},
			} as unknown as IExecuteSingleFunctions,
			synchronousRequest,
		);
		expect(synchronousRequest.headers).toEqual({ 'Content-Type': 'application/json' });

		const asynchronousRequest: IHttpRequestOptions = { url: '/pdf-info' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes only the public resource ID request branch and no binary input', () => {
		const publicDefinition = JSON.stringify(pdfInfoDescription);

		expect(pdfInfoDescription.map((field) => field.name)).toEqual([
			'resourceId',
			'queries',
			'selectedQueries',
			'options',
		]);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('Input File');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).not.toContain('"property":"file"');
	});
});
