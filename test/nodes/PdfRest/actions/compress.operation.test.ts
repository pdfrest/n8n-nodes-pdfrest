import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	compressDescription,
	compressOperation,
} from '../../../../nodes/PdfRest/actions/compress.operation';

function getOptionalField(name: string) {
	return compressDescription
		.find((field) => field.name === 'options')
		?.options?.find((field) => field.name === name);
}

function createContext(
	compressionLevel: 'low' | 'medium' | 'high' | 'custom',
	profileInputType: 'inputFile' | 'resourceId' = 'inputFile',
) {
	return {
		getNodeParameter: (name: string, fallback: unknown) => {
			if (name === 'compressionLevel') {
				expect(fallback).toBe('medium');
				return compressionLevel;
			}
			if (name === 'profileInputType') {
				expect(fallback).toBe('inputFile');
				return profileInputType;
			}
			throw new Error(`Unexpected parameter: ${name}`);
		},
		getNode: () => ({
			name: 'Compress PDF',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	} as unknown as IExecuteSingleFunctions;
}

describe('Compress PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(compressOperation).toMatchObject({
			name: 'Compress PDF',
			value: 'compress',
			action: 'Optimize · Compress PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/compressed-pdf',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('requires the public resource ID branch with exact body routing', () => {
		expect(compressDescription[0]).toMatchObject({
			displayName: 'Resource ID',
			name: 'resourceId',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['compress'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('requires every compression level with the balanced medium default', () => {
		expect(compressDescription[1]).toMatchObject({
			displayName: 'Compression Level',
			name: 'compressionLevel',
			type: 'options',
			options: [
				{ name: 'Low', value: 'low' },
				{ name: 'Medium', value: 'medium' },
				{ name: 'High', value: 'high' },
				{ name: 'Custom', value: 'custom' },
			],
			default: 'medium',
			required: true,
			displayOptions: { show: { operation: ['compress'] } },
			routing: { send: { type: 'body', property: 'compression_level' } },
		});
		expect(compressDescription[1].routing?.send?.preSend).toHaveLength(1);
	});

	it('defaults the custom profile source to an input file and retains the resource ID branch', () => {
		expect(compressDescription.find(({ name }) => name === 'profileInputType')).toMatchObject({
			displayName: 'Profile Input Source',
			default: 'inputFile',
			displayOptions: { show: { operation: ['compress'], compressionLevel: ['custom'] } },
		});
		expect(compressDescription.find(({ name }) => name === 'profileId')).toMatchObject({
			displayName: 'Profile Resource ID',
			name: 'profileId',
			type: 'string',
			default: '',
			required: false,
			displayOptions: {
				show: {
					operation: ['compress'],
					compressionLevel: ['custom'],
					profileInputType: ['resourceId'],
				},
			},
			routing: { send: { type: 'body', property: 'profile_id' } },
		});
		expect(
			compressDescription.find(({ name }) => name === 'profileFileDataFieldName'),
		).toMatchObject({
			default: 'data',
			required: false,
			routing: { send: { type: 'body', property: 'profile' } },
		});
	});

	it('omits inactive profile IDs for every standard compression branch', async () => {
		const preSend = compressDescription[1].routing?.send?.preSend?.[0];
		expect(preSend).toBeDefined();

		for (const compressionLevel of ['low', 'medium', 'high'] as const) {
			const request: IHttpRequestOptions = {
				url: '/compressed-pdf',
				body: {
					id: 'resource-id',
					compression_level: compressionLevel,
					profile_id: 'stale-profile-id',
					profile: 'data',
				},
			};
			await expect(preSend?.call(createContext(compressionLevel), request)).resolves.toBe(request);
			expect(request.body).toEqual({
				id: 'resource-id',
				compression_level: compressionLevel,
			});
		}
	});

	it('accepts a custom profile ID and rejects a missing or blank resource ID', async () => {
		const preSend = compressDescription[1].routing?.send?.preSend?.[0];
		const valid: IHttpRequestOptions = {
			url: '/compressed-pdf',
			body: {
				id: 'resource-id',
				compression_level: 'custom',
				profile_id: 'profile-resource-id',
			},
		};
		await expect(preSend?.call(createContext('custom', 'resourceId'), valid)).resolves.toBe(valid);

		for (const profileId of [undefined, '']) {
			const invalid: IHttpRequestOptions = {
				url: '/compressed-pdf',
				body: {
					id: 'resource-id',
					compression_level: 'custom',
					...(profileId === undefined ? {} : { profile_id: profileId }),
				},
			};
			await expect(
				preSend?.call(createContext('custom', 'resourceId'), invalid),
			).rejects.toThrow('Profile Resource ID is required for custom compression.');
		}
	});

	it('does not register a profile file upload for expression-driven preset levels', async () => {
		const profileFile = compressDescription.find(
			({ name }) => name === 'profileFileDataFieldName',
		);
		const preSend = profileFile?.routing?.send?.preSend?.[0];

		for (const compressionLevel of ['low', 'medium', 'high'] as const) {
			const request: IHttpRequestOptions = {
				url: '/compressed-pdf',
				body: {
					id: 'resource-id',
					compression_level: compressionLevel,
					profile: 'data',
				},
			};
			await expect(preSend?.call(createContext(compressionLevel), request)).resolves.toBe(request);
			expect(request.body).toEqual({
				id: 'resource-id',
				compression_level: compressionLevel,
			});
		}
	});

	it('groups declared optional fields and inherited headers alphabetically', () => {
		const options = compressDescription.find((field) => field.name === 'options');
		expect(options).toMatchObject({
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: { show: { operation: ['compress'] } },
		});
		expect(options?.options?.map((field) => field.name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);
	});

	it('routes and validates the optional non-empty output file name', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			name: 'output',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		expect(output?.routing?.send?.preSend).toHaveLength(1);

		const preSend = output?.routing?.send?.preSend?.[0];
		const omitted: IHttpRequestOptions = {
			url: '/compressed-pdf',
			body: { id: 'resource-id', compression_level: 'medium' },
		};
		await expect(preSend?.call(createContext('medium'), omitted)).resolves.toBe(omitted);

		const valid: IHttpRequestOptions = {
			url: '/compressed-pdf',
			body: { id: 'resource-id', compression_level: 'medium', output: 'compressed' },
		};
		await expect(preSend?.call(createContext('medium'), valid)).resolves.toBe(valid);

		const invalid: IHttpRequestOptions = {
			url: '/compressed-pdf',
			body: { id: 'resource-id', compression_level: 'medium', output: '' },
		};
		await expect(preSend?.call(createContext('medium'), invalid)).rejects.toThrow(
			'Output File Name must contain at least one character.',
		);
	});

	it('routes Include-File-Info with its false default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		const request: IHttpRequestOptions = { url: '/compressed-pdf' };

		expect(includeFileInfo).toMatchObject({
			displayName: 'Include File Info',
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

	it('omits Response-Type by default and supports requestId', async () => {
		const responseType = getOptionalField('responseType');
		const preSend = responseType?.routing?.send?.preSend?.[0];

		expect(responseType).toMatchObject({
			displayName: 'Response Type',
			type: 'options',
			options: [
				{ name: 'Synchronous Response', value: '' },
				{ name: 'Request ID', value: 'requestId' },
			],
			default: '',
			routing: { send: {} },
		});

		const synchronousRequest: IHttpRequestOptions = {
			url: '/compressed-pdf',
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

		const asynchronousRequest: IHttpRequestOptions = { url: '/compressed-pdf' };
		await preSend?.call(
			{ getNodeParameter: () => 'requestId' } as unknown as IExecuteSingleFunctions,
			asynchronousRequest,
		);
		expect(asynchronousRequest.headers).toEqual({ 'Response-Type': 'requestId' });
	});

	it('exposes only resource IDs and the declared JSON body properties', () => {
		const publicDefinition = JSON.stringify(compressDescription);
		const bodyProperties = compressDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);

		expect(bodyProperties).toEqual(['id', 'compression_level', 'profile_id', 'profile', 'output']);
		expect(publicDefinition).not.toContain('inputType');
		expect(publicDefinition).not.toContain('inputFileDataFieldName');
		expect(publicDefinition).toContain('Profile Input Source');
		expect(bodyProperties).not.toContain('file');
		expect(bodyProperties).toContain('profile');
	});
});
