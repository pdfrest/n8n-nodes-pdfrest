import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	addShapesDescription,
	addShapesOperation,
} from '../../../../nodes/PdfRest/actions/addShapes.operation';

function getField(name: string) {
	return addShapesDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

function context(tagEnabled: unknown = false): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'Add Shapes to PDF',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name: string, fallback: unknown) => {
			expect(name).toBe('options.tagEnabled');
			expect(fallback).toBe(false);
			return tagEnabled;
		},
	} as unknown as IExecuteSingleFunctions;
}

const line = {
	type: 'line',
	page: 1,
	x1: 72,
	y1: 576,
	x2: 540,
	y2: 576,
};

const rectangle = {
	type: 'rectangle',
	page: 1,
	x: 54,
	y: 540,
	width: 504,
	height: 108,
};

async function serialize(shapeObjects: unknown, tagEnabled: unknown = false) {
	const request: IHttpRequestOptions = {
		url: '/pdf-with-added-shapes',
		body: { shape_objects: shapeObjects },
	};
	await getField('shapeObjects')?.routing?.send?.preSend?.[0]?.call(context(tagEnabled), request);
	return request;
}

describe('Add Shapes to PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(addShapesOperation).toMatchObject({
			name: 'Add Shapes to PDF',
			value: 'addShapes',
			action: 'Modify · Add Shapes to PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-added-shapes',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes the required Resource ID and Shape Objects fields', () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['addShapes'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(getField('shapeObjects')).toMatchObject({
			displayName: 'Shape Objects',
			type: 'json',
			required: true,
			displayOptions: { show: { operation: ['addShapes'] } },
			routing: { send: { type: 'body', property: 'shape_objects' } },
		});
		expect(String(getField('shapeObjects')?.default)).toContain('\n');
		expect(JSON.parse(String(getField('shapeObjects')?.default))).toEqual([
			{
				...rectangle,
				fill_color_rgb: '245,247,250',
				stroke_color_rgb: '26,72,112',
				stroke_width: 1,
			},
			{
				...line,
				stroke_color_rgb: '26,72,112',
				stroke_width: 1.5,
			},
		]);
	});

	it('accepts a single object, typed array, literal JSON, and expression-resolved JSON', async () => {
		for (const input of [line, [line], JSON.stringify([line]), [line]]) {
			const request = await serialize(input);
			const shapeObjects = (request.body as Record<string, unknown>).shape_objects;
			expect(shapeObjects).toEqual(input === line ? line : [line]);
		}
	});

	it('accepts complete line and rectangle objects with every nested field', async () => {
		const completeLine = {
			...line,
			page: 'all',
			stroke_color_cmyk: '0, 100, 100, 0',
			stroke_width: 1.5,
			opacity: 0,
			tag_actual_text: 'Section divider',
			tag_is_artifact: false,
			tag_structure_type: 'Figure',
		};
		const completeRectangle = {
			...rectangle,
			fill_color_rgb: '245,247,250',
			stroke_color_cmyk: '100,0,0,25',
			stroke_width: 2,
			opacity: 1,
			tag_actual_text: 'Background panel',
			tag_is_artifact: true,
			tag_structure_type: 'Form',
		};
		const request = await serialize([completeLine, completeRectangle], true);
		expect((request.body as Record<string, unknown>).shape_objects).toEqual([
			completeLine,
			completeRectangle,
		]);
	});

	it('accepts each RGB and CMYK color branch independently', async () => {
		await expect(serialize({ ...line, stroke_color_rgb: ' 0, 128, 255 ' })).resolves.toBeDefined();
		await expect(
			serialize({
				...rectangle,
				fill_color_cmyk: '0,0,0,100',
				stroke_color_rgb: '26,72,112',
			}),
		).resolves.toBeDefined();
	});

	it('accepts every PDF content structure type when tagging is enabled', async () => {
		const types = [
			'P',
			'H',
			'H1',
			'H2',
			'H3',
			'H4',
			'H5',
			'H6',
			'Lbl',
			'Span',
			'Quote',
			'Note',
			'Reference',
			'BibEntry',
			'Code',
			'Link',
			'Annot',
			'Ruby',
			'RB',
			'RT',
			'RP',
			'Warichu',
			'WT',
			'WP',
			'Figure',
			'Formula',
			'Form',
		];
		await expect(
			serialize(
				types.map((tag_structure_type) => ({ ...line, tag_structure_type })),
				true,
			),
		).resolves.toBeDefined();
	});

	it.each([
		['invalid JSON', '{'],
		['empty array', []],
		['non-object shape', [null]],
		['unknown shape type', [{ ...line, type: 'circle' }]],
		['unsupported line property', [{ ...line, width: 10 }]],
		['unsupported rectangle property', [{ ...rectangle, x1: 10 }]],
		['missing required coordinate', [{ ...line, x1: undefined }]],
		['negative coordinate', [{ ...rectangle, x: -1 }]],
		['non-finite coordinate', [{ ...line, x1: Number.NaN }]],
		['zero rectangle width', [{ ...rectangle, width: 0 }]],
		['zero rectangle height', [{ ...rectangle, height: 0 }]],
		['zero stroke width', [{ ...line, stroke_width: 0 }]],
		['negative opacity', [{ ...line, opacity: -0.1 }]],
		['opacity above one', [{ ...line, opacity: 1.1 }]],
		['page zero', [{ ...line, page: 0 }]],
		['fractional page', [{ ...line, page: 1.5 }]],
		['string page number', [{ ...line, page: '1' }]],
		['invalid RGB color', [{ ...line, stroke_color_rgb: '256,0,0' }]],
		['invalid CMYK color', [{ ...rectangle, fill_color_cmyk: '0,0,0,101' }]],
		[
			'both line stroke colors',
			[{ ...line, stroke_color_rgb: '0,0,0', stroke_color_cmyk: '0,0,0,0' }],
		],
		[
			'both rectangle fill colors',
			[{ ...rectangle, fill_color_rgb: '0,0,0', fill_color_cmyk: '0,0,0,0' }],
		],
		[
			'both rectangle stroke colors',
			[{ ...rectangle, stroke_color_rgb: '0,0,0', stroke_color_cmyk: '0,0,0,0' }],
		],
		['empty tag actual text', [{ ...line, tag_actual_text: '' }]],
		['non-boolean artifact flag', [{ ...line, tag_is_artifact: 'false' }]],
		['unsupported structure type', [{ ...line, tag_structure_type: 'Section' }]],
	])('rejects %s', async (_case, shapeObjects) => {
		await expect(serialize(shapeObjects, true)).rejects.toThrow();
	});

	it('requires Tag Enabled for every per-shape tagging property', async () => {
		const values = {
			tag_actual_text: 'Divider',
			tag_is_artifact: false,
			tag_structure_type: 'Figure',
		};
		for (const property of Object.keys(values) as Array<keyof typeof values>) {
			await expect(serialize([{ ...line, [property]: values[property] }])).rejects.toThrow(
				'tag properties require Tag Enabled to be true',
			);
		}
	});

	it('does not inject the optional tag artifact default into shape objects', async () => {
		const request = await serialize(line);
		const shapeObject = (request.body as Record<string, unknown>).shape_objects;
		expect(shapeObject).not.toHaveProperty('tag_is_artifact');
	});

	it('validates typed Tag Enabled expressions', async () => {
		await expect(serialize(line, 'true')).rejects.toThrow('Tag Enabled must be a boolean.');

		const tagEnabled = getOptionalField('tagEnabled');
		await expect(
			tagEnabled?.routing?.send?.preSend?.[0]?.call(context('false'), {
				url: '/pdf-with-added-shapes',
				body: { tag_enabled: 'false' },
			}),
		).rejects.toThrow('Tag Enabled must be a boolean.');
	});

	it('maps only the top-level optional fields declared by the resolved schema', () => {
		expect(getField('options')).toMatchObject({
			displayName: 'Optional Fields',
			type: 'collection',
			default: {},
			displayOptions: { show: { operation: ['addShapes'] } },
		});
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
			'tagEnabled',
		]);
		expect(getOptionalField('tagEnabled')).toMatchObject({
			displayName: 'Tag Enabled',
			type: 'boolean',
			default: false,
			description: expect.stringMatching(/^Whether to/),
			routing: { send: { type: 'body', property: 'tag_enabled' } },
		});
		expect(getOptionalField('tagLanguage')).toBeUndefined();
	});

	it('validates output and inherited headers while omitting Response-Type by default', async () => {
		const output = getOptionalField('output');
		expect(output).toMatchObject({
			displayName: 'Output File Name',
			type: 'string',
			default: '',
			routing: { send: { type: 'body', property: 'output' } },
		});
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(context(), {
				url: '/pdf-with-added-shapes',
				body: { output: '' },
			}),
		).rejects.toThrow('Output File Name must contain at least one character');

		const includeFileInfo = getOptionalField('includeFileInfo');
		const includeRequest: IHttpRequestOptions = { url: '/pdf-with-added-shapes' };
		await includeFileInfo?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseType = getOptionalField('responseType');
		expect(responseType).toMatchObject({ default: '' });
		const responseRequest: IHttpRequestOptions = {
			url: '/pdf-with-added-shapes',
			headers: { Accept: 'application/json', 'Response-Type': '' },
		};
		await responseType?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes exact JSON request properties without a public binary input', () => {
		const definition = JSON.stringify(addShapesDescription);
		expect(definition).not.toContain('inputType');
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('"property":"file"');

		const bodyProperties = addShapesDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual(['id', 'shape_objects', 'output', 'tag_enabled']);
	});
});
