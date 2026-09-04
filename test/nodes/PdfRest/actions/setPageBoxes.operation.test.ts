import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	setPageBoxesDescription,
	setPageBoxesOperation,
} from '../../../../nodes/PdfRest/actions/setPageBoxes.operation';

function getField(name: string) {
	return setPageBoxesDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

const nodeContext = {
	getNode: () => ({
		name: 'Set PDF Page Boxes',
		type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
		typeVersion: 1,
		position: [0, 0],
		parameters: {},
	}),
} as unknown as IExecuteSingleFunctions;

function definition(box: string, range: string, margin: number) {
	return {
		boxes: [
			{
				box,
				pages: [{ range, top: margin, bottom: margin, left: margin, right: margin }],
			},
		],
	};
}

async function serialize(value: unknown) {
	const request: IHttpRequestOptions = {
		url: '/pdf-with-page-boxes-set',
		body: { boxes: value },
	};
	await getField('pageBoxDefinitions')?.routing?.send?.preSend?.[0]?.call(nodeContext, request);
	return request;
}

describe('Set PDF Page Boxes operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(setPageBoxesOperation).toMatchObject({
			name: 'Set PDF Page Boxes',
			value: 'setPageBoxes',
			action: 'Modify · Set Page Boxes (Crop, Trim)',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-page-boxes-set',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes the required Resource ID and Page Box Definitions', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['setPageBoxes'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(getField('pageBoxDefinitions')).toMatchObject({
			displayName: 'Page Box Definitions',
			type: 'json',
			required: true,
			displayOptions: { show: { operation: ['setPageBoxes'] } },
			routing: { send: { type: 'body', property: 'boxes' } },
		});
		expect(String(getField('pageBoxDefinitions')?.default)).toContain('\n');
		expect(JSON.parse(String(getField('pageBoxDefinitions')?.default))).toEqual({
			boxes: [
				{
					box: 'crop',
					pages: [
						{ range: '1-10', left: 72, top: 36, bottom: 36, right: 72 },
						{ range: '11-last', left: 72, top: 72, bottom: 72, right: 72 },
					],
				},
				{
					box: 'bleed',
					pages: [{ range: '1-last', left: 144, top: 144, bottom: 144, right: 144 }],
				},
			],
		});
	});

	it('accepts typed, literal, and expression-resolved JSON and serializes it', async () => {
		const value = definition('crop', '1-last', 36);
		for (const input of [value, JSON.stringify(value), value]) {
			const request = await serialize(input);
			expect((request.body as Record<string, unknown>).boxes).toBe(JSON.stringify(value));
		}
	});

	it('accepts MediaBox margins as any finite numbers', async () => {
		const value = {
			boxes: [
				{
					box: 'media',
					pages: [{ range: 'all', top: -72, bottom: 0, left: 18.5, right: -0.5 }],
				},
			],
		};
		await expect(serialize(value)).resolves.toBeDefined();
	});

	it.each(['crop', 'bleed', 'trim', 'art'])(
		'accepts positive margins for the %s page-box branch',
		async (box) => {
			await expect(serialize(definition(box, 'odd', 0.5))).resolves.toBeDefined();
		},
	);

	it.each(['all', 'even', 'odd', '1', '1-3', '2-last'])(
		'accepts the %s page-range form',
		async (range) => {
			await expect(serialize(definition('crop', range, 1))).resolves.toBeDefined();
		},
	);

	it('accepts multiple box definitions and page definitions in order', async () => {
		const value = {
			boxes: [
				{
					box: 'media',
					pages: [
						{ range: '1', top: -10, bottom: -10, left: -10, right: -10 },
						{ range: '2-last', top: 0, bottom: 0, left: 0, right: 0 },
					],
				},
				{
					box: 'trim',
					pages: [{ range: 'all', top: 12, bottom: 12, left: 18, right: 18 }],
				},
			],
		};
		const request = await serialize(value);
		expect(JSON.parse(String((request.body as Record<string, unknown>).boxes))).toEqual(value);
	});

	it.each([
		['invalid JSON', '{'],
		['non-object definition', []],
		['extra top-level property', { ...definition('crop', 'all', 1), extra: true }],
		['missing boxes', {}],
		['non-array boxes', { boxes: 'crop' }],
		['empty boxes', { boxes: [] }],
		['non-object box', { boxes: [null] }],
		[
			'unsupported box property',
			{ boxes: [{ ...definition('crop', 'all', 1).boxes[0], extra: true }] },
		],
		['unsupported box type', definition('content', 'all', 1)],
		['missing pages', { boxes: [{ box: 'crop' }] }],
		['non-array pages', { boxes: [{ box: 'crop', pages: 'all' }] }],
		['empty pages', { boxes: [{ box: 'crop', pages: [] }] }],
		['non-object page', { boxes: [{ box: 'crop', pages: [null] }] }],
		[
			'unsupported page property',
			{
				boxes: [
					{
						box: 'crop',
						pages: [{ range: 'all', top: 1, bottom: 1, left: 1, right: 1, extra: true }],
					},
				],
			},
		],
		['invalid range', definition('crop', 'last', 1)],
		[
			'missing margin',
			{
				boxes: [{ box: 'crop', pages: [{ range: 'all', top: 1, bottom: 1, left: 1 }] }],
			},
		],
		['non-number margin', definition('crop', 'all', '1' as unknown as number)],
		['non-finite margin', definition('crop', 'all', Number.NaN)],
		['zero positive margin', definition('crop', 'all', 0)],
		['negative positive margin', definition('art', 'all', -1)],
	])('rejects %s', async (_case, value) => {
		await expect(serialize(value)).rejects.toThrow();
	});

	it('groups optional fields alphabetically and validates output', async () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['setPageBoxes'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
		]);

		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		const omitted: IHttpRequestOptions = { url: '/pdf-with-page-boxes-set', body: {} };
		await expect(output?.routing?.send?.preSend?.[0]?.call(nodeContext, omitted)).resolves.toBe(
			omitted,
		);
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(nodeContext, {
				url: '/pdf-with-page-boxes-set',
				body: { output: '' },
			}),
		).rejects.toThrow('Output File Name must contain at least one character');
	});

	it('routes Include-File-Info and omits Response-Type by default', async () => {
		const includeFileInfo = getOptionalField('includeFileInfo');
		expect(includeFileInfo).toMatchObject({
			type: 'boolean',
			default: false,
		});
		const includeRequest: IHttpRequestOptions = { url: '/pdf-with-page-boxes-set' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({ default: '' });
		const responseRequest: IHttpRequestOptions = {
			url: '/pdf-with-page-boxes-set',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes exact JSON request properties and no public binary input or selector', () => {
		const definitionJson = JSON.stringify(setPageBoxesDescription);
		expect(definitionJson).not.toContain('inputType');
		expect(definitionJson).not.toContain('inputFileDataFieldName');
		expect(definitionJson).not.toContain('Input File');
		expect(definitionJson).not.toContain('"property":"file"');

		const bodyProperties = setPageBoxesDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'boxes', 'output']);
	});
});
