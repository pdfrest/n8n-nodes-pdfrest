import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	addTablesDescription,
	addTablesOperation,
} from '../../../../nodes/PdfRest/actions/addTables.operation';

const firstImageId = '11111111-1111-4111-8111-111111111111';
const secondImageId = '22222222-2222-4222-8222-222222222222';

const simpleTable = {
	page: 1,
	x: 54,
	y: 540,
	width: 504,
	columns: [{ width: 252 }, { width: 252 }],
	rows: [{ cells: [{ text: 'Name' }, { text: 'Value' }] }],
};

const tableObjectsExample = [
	{
		page: 1,
		x: 54,
		y: 540,
		width: 504,
		columns: [{ width: 252 }, { width: 252 }],
		header_rows: [{ cells: [{ text: 'Milestone' }, { text: 'Status' }] }],
		rows: [
			{
				cells: [{ text: 'Requirements review' }, { text: 'Complete' }],
			},
		],
	},
];

function getField(name: string) {
	return addTablesDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

function context(tagEnabled: unknown = false, imageIds: unknown = []): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'Add Tables to PDF',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name: string, fallback: unknown) => {
			if (name === 'options.tagEnabled') return tagEnabled;
			if (name === 'options.imageResourceIds') return imageIds;
			return fallback;
		},
	} as unknown as IExecuteSingleFunctions;
}

async function runTables(
	tableObjects: unknown,
	options: { tagEnabled?: unknown; imageIds?: unknown } = {},
): Promise<IHttpRequestOptions> {
	const request: IHttpRequestOptions = {
		url: '/pdf-with-added-tables',
		body: { table_objects: tableObjects },
	};
	await getField('tableObjects')?.routing?.send?.preSend?.[0]?.call(
		context(options.tagEnabled, options.imageIds),
		request,
	);
	return request;
}

describe('Add Tables to PDF operation', () => {
	it('uses the OpenAPI operation identity and JSON route', () => {
		expect(addTablesOperation).toMatchObject({
			name: 'Add Tables to PDF',
			value: 'addTables',
			action: 'Modify · Add Tables to PDF',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-added-tables',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('routes the required PDF resource ID and Table Objects JSON', async () => {
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { operation: ['addTables'] } },
			routing: { send: { type: 'body', property: 'id' } },
		});
		expect(getField('tableObjects')).toMatchObject({
			displayName: 'Table Objects',
			type: 'json',
			required: true,
			displayOptions: { show: { operation: ['addTables'] } },
			routing: { send: { type: 'body', property: 'table_objects' } },
		});
		expect(String(getField('tableObjects')?.default)).toContain('\n');
		expect(JSON.parse(String(getField('tableObjects')?.default))).toEqual(tableObjectsExample);
		await expect(runTables(tableObjectsExample)).resolves.toBeDefined();
	});

	it('accepts typed, literal, and expression-resolved JSON and preserves object or array shape', async () => {
		for (const input of [simpleTable, JSON.stringify(simpleTable), [simpleTable]]) {
			const request = await runTables(input);
			const expected = Array.isArray(input) ? [simpleTable] : simpleTable;
			expect((request.body as Record<string, unknown>).table_objects).toEqual(expected);
			expect(request.body).not.toHaveProperty('image_ids');
		}
	});

	it('accepts the percentage-width, alignment, pagination, style, span, image, and tag branches', async () => {
		const table = {
			page: 2,
			y: 700,
			width_percentage: 80,
			width_mode: 'relative',
			horizontal_align: 'center',
			is_rtl: false,
			keep_table_block_together: true,
			spacing_before: 2,
			spacing_after: 3,
			continuation_page_top_margin: 4,
			page_bottom_margin: 5,
			final_page_bottom_margin: 6,
			overflow_behavior: 'split-row',
			row_split_behavior: 'prefer-next-page',
			repeat_header_on_overflow: true,
			repeat_footer_on_overflow: false,
			show_header_on_first_page: true,
			show_footer_on_last_page: false,
			columns: [
				{
					width: 1,
					style: {
						font: 'Arial',
						text_size: 10,
						text_align: 'left',
						vertical_align: 'top',
						text_color_rgb: '255, 255, 255',
						background_color_cmyk: [0, 10.5, 20, 0],
						opacity: 0.75,
						padding: { top: 1, right: 2, bottom: 3, left: 4 },
						border: {
							top: { width: 1, color_rgb: [1, 2, 3], opacity: 1 },
							right: { color_cmyk: '0,0,0,100' },
							bottom: {},
							left: { width: 0 },
						},
					},
				},
				{ width: 2 },
			],
			header_rows: [
				{
					min_height: 10,
					style: { text_color_cmyk: [0, 0, 0, 100] },
					cells: [{ text: 'Header', col_span: 2, tag_structure_type: 'TH' }],
				},
			],
			rows: [
				{
					cells: [
						{
							text: 'Text',
							row_span: 1,
							min_height: 5,
							fixed_height: 6,
							no_wrap: true,
							is_rtl: false,
							style: { background_color_rgb: [220, 252, 231] },
							tag_actual_text: 'Text value',
							tag_structure_type: 'TD',
						},
						{
							image: {
								image_index: 1,
								width: 18,
								height: 18,
								tag_alt_text: 'Status',
								tag_is_artifact: false,
								tag_structure_type: 'Figure',
							},
						},
					],
				},
			],
			footer_rows: [{ cells: [{ col_span: 2 }] }],
			style: { text_align: 'right', vertical_align: 'bottom' },
			tag_is_artifact: false,
			tag_structure_type: 'Table',
		};
		const request = await runTables([table], {
			tagEnabled: true,
			imageIds: [firstImageId, secondImageId],
		});
		expect(request.body).toMatchObject({
			image_ids: [firstImageId, secondImageId],
			table_objects: [table],
		});
	});

	it('supports x and horizontal alignment together and every declared enum value', async () => {
		for (const horizontal_align of ['left', 'center', 'right']) {
			for (const overflow_behavior of ['move-row', 'split-row', 'fail']) {
				for (const row_split_behavior of ['split-when-needed', 'prefer-next-page']) {
					await expect(
						runTables({
							...simpleTable,
							horizontal_align,
							overflow_behavior,
							row_split_behavior,
						}),
					).resolves.toBeDefined();
				}
			}
		}
	});

	it('accounts for row spans across rows without allowing overlap or section crossing', async () => {
		const spanningTable = {
			...simpleTable,
			rows: [
				{ cells: [{ text: 'Spans two rows', row_span: 2 }, { text: 'First' }] },
				{ cells: [{ text: 'Second' }] },
				{ cells: [{ text: 'Third' }, { text: 'Fourth' }] },
			],
		};
		await expect(runTables(spanningTable)).resolves.toBeDefined();

		await expect(
			runTables({
				...simpleTable,
				rows: [
					{ cells: [{ text: 'Spans two rows', row_span: 2 }, { text: 'First' }] },
					{ cells: [{ text: 'Overlap', col_span: 2 }] },
				],
			}),
		).rejects.toThrow('overlapping or out-of-range span');

		await expect(
			runTables({
				...simpleTable,
				header_rows: [{ cells: [{ text: 'Crosses section', row_span: 2 }, { text: 'Header' }] }],
			}),
		).rejects.toThrow('row span that crosses its table section');
	});

	it.each([
		['invalid JSON', '{'],
		['empty array', []],
		['non-object', '[]'],
		['extra table property', { ...simpleTable, extra: true }],
		['missing page', { ...simpleTable, page: undefined }],
		['invalid page', { ...simpleTable, page: 0 }],
		['negative y', { ...simpleTable, y: -1 }],
		['both widths', { ...simpleTable, width_percentage: 50 }],
		['no width', { ...simpleTable, width: undefined }],
		['no position', { ...simpleTable, x: undefined }],
		[
			'percentage without relative mode',
			{ ...simpleTable, width: undefined, width_percentage: 50 },
		],
		['invalid width mode', { ...simpleTable, width_mode: 'automatic' }],
		['invalid horizontal alignment', { ...simpleTable, horizontal_align: 'middle' }],
		['invalid table boolean', { ...simpleTable, is_rtl: 'false' }],
		['negative spacing', { ...simpleTable, spacing_after: -1 }],
		['negative continuation margin', { ...simpleTable, continuation_page_top_margin: -1 }],
		[
			'final margin below page margin',
			{ ...simpleTable, page_bottom_margin: 10, final_page_bottom_margin: 9 },
		],
		['obsolete footer field', { ...simpleTable, show_footer_on_first_page: false }],
		['invalid overflow behavior', { ...simpleTable, overflow_behavior: 'continue' }],
		['invalid row split behavior', { ...simpleTable, row_split_behavior: 'never' }],
		['empty columns', { ...simpleTable, columns: [] }],
		['invalid column width', { ...simpleTable, columns: [{ width: 0 }, { width: 504 }] }],
		['fixed column total mismatch', { ...simpleTable, columns: [{ width: 1 }, { width: 1 }] }],
		['empty rows', { ...simpleTable, rows: [] }],
		['empty optional rows', { ...simpleTable, header_rows: [] }],
		['row column mismatch', { ...simpleTable, rows: [{ cells: [{ text: 'one' }] }] }],
	])('rejects %s', async (_case, tableObjects) => {
		await expect(runTables(tableObjects)).rejects.toThrow();
	});

	it.each([
		['extra row property', { ...simpleTable.rows[0], extra: true }],
		['empty cells', { cells: [] }],
		['negative row height', { ...simpleTable.rows[0], min_height: -1 }],
		['non-object cell', { cells: ['text', { text: 'two' }] }],
		['extra cell property', { cells: [{ text: 'one', extra: true }, { text: 'two' }] }],
		['text and image', { cells: [{ text: 'one', image: { image_index: 0 } }, { text: 'two' }] }],
		['non-string text', { cells: [{ text: 1 }, { text: 'two' }] }],
		['invalid column span', { cells: [{ text: 'one', col_span: 0 }, { text: 'two' }] }],
		['invalid row span', { cells: [{ text: 'one', row_span: 1.5 }, { text: 'two' }] }],
		['negative cell height', { cells: [{ text: 'one', min_height: -1 }, { text: 'two' }] }],
		[
			'fixed height below minimum',
			{ cells: [{ text: 'one', min_height: 5, fixed_height: 4 }, { text: 'two' }] },
		],
		['invalid cell boolean', { cells: [{ text: 'one', no_wrap: 'true' }, { text: 'two' }] }],
		['empty actual text', { cells: [{ text: 'one', tag_actual_text: '' }, { text: 'two' }] }],
		['invalid cell tag', { cells: [{ text: 'one', tag_structure_type: 'P' }, { text: 'two' }] }],
	])('rejects %s', async (_case, row) => {
		await expect(
			runTables({ ...simpleTable, rows: [row] }, { tagEnabled: true }),
		).rejects.toThrow();
	});

	it('validates style, padding, border, color, and color-model constraints', async () => {
		const invalidStyles = [
			{ unsupported: true },
			{ font: 123 },
			{ text_size: 0 },
			{ text_align: 'justify' },
			{ vertical_align: 'center' },
			{ opacity: 1.1 },
			{ text_color_rgb: '256,0,0' },
			{ text_color_rgb: [1, 2, 3.5] },
			{ text_color_cmyk: [0, 0, 0] },
			{ text_color_rgb: '1,2,3', text_color_cmyk: '0,0,0,0' },
			{ background_color_rgb: [1, 2, 3], background_color_cmyk: [0, 0, 0, 0] },
			{ padding: { top: -1 } },
			{ padding: { diagonal: 1 } },
			{ border: { diagonal: {} } },
			{ border: { top: { width: -1 } } },
			{ border: { top: { opacity: -0.1 } } },
			{ border: { top: { color_rgb: [1, 2, 3], color_cmyk: [0, 0, 0, 0] } } },
		];
		for (const style of invalidStyles) {
			await expect(runTables({ ...simpleTable, style })).rejects.toThrow();
		}
	});

	it('validates image objects, ordered image IDs, and every image index', async () => {
		const imageTable = (image: unknown) => ({
			...simpleTable,
			rows: [{ cells: [{ image }, { text: 'two' }] }],
		});
		for (const image of [
			{ image_index: -1 },
			{ image_index: 0.5 },
			{ image_index: 0, width: 0 },
			{ image_index: 0, height: -1 },
			{ image_index: 0, extra: true },
			{ image_index: 0, tag_alt_text: '' },
			{ image_index: 0, tag_is_artifact: 'false' },
			{ image_index: 0, tag_structure_type: 'Image' },
		]) {
			await expect(
				runTables(imageTable(image), { tagEnabled: true, imageIds: [firstImageId] }),
			).rejects.toThrow();
		}

		await expect(runTables(imageTable({ image_index: 0 }))).rejects.toThrow(
			'image_index must reference an available Image Resource ID',
		);
		await expect(
			runTables(imageTable({ image_index: 1 }), { imageIds: [firstImageId] }),
		).rejects.toThrow('image_index must reference an available Image Resource ID');
		for (const imageIds of ['not-an-array', ['not-a-uuid'], [firstImageId, '']]) {
			await expect(runTables(simpleTable, { imageIds })).rejects.toThrow('Image Resource ID');
		}
	});

	it('requires Tag Enabled for table, cell, and image tagging properties', async () => {
		const taggedTables = [
			{ ...simpleTable, tag_is_artifact: false },
			{ ...simpleTable, tag_structure_type: 'Table' },
			{
				...simpleTable,
				rows: [{ cells: [{ text: 'one', tag_actual_text: 'One' }, { text: 'two' }] }],
			},
			{
				...simpleTable,
				rows: [{ cells: [{ text: 'one', tag_structure_type: 'TD' }, { text: 'two' }] }],
			},
			{
				...simpleTable,
				rows: [{ cells: [{ image: { image_index: 0, tag_alt_text: 'Icon' } }, { text: 'two' }] }],
			},
		];
		for (const table of taggedTables) {
			await expect(runTables(table, { imageIds: [firstImageId] })).rejects.toThrow(
				'tag properties require Tag Enabled to be true',
			);
		}
	});

	it('declares ordered optional image IDs and progressive tagging fields', () => {
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'imageResourceIds',
			'includeFileInfo',
			'output',
			'responseType',
			'tagEnabled',
			'tagLanguage',
		]);
		expect(getOptionalField('imageResourceIds')).toMatchObject({
			displayName: 'Image Resource IDs',
			type: 'string',
			typeOptions: { multipleValues: true, multipleValueButtonText: 'Add Image Resource ID' },
			default: [],
			routing: { send: { type: 'body', property: 'image_ids' } },
		});
		expect(getOptionalField('tagEnabled')).toMatchObject({
			type: 'boolean',
			default: false,
			description: expect.stringMatching(/^Whether to/),
			routing: { send: { type: 'body', property: 'tag_enabled' } },
		});
		expect(getOptionalField('tagLanguage')).toMatchObject({
			type: 'string',
			default: 'en-US',
			displayOptions: { show: { tagEnabled: [true] } },
			routing: { send: { type: 'body', property: 'tag_language' } },
		});
	});

	it('removes inactive Tag Language and validates active BCP 47 tags', async () => {
		const preSend = getOptionalField('tagEnabled')?.routing?.send?.preSend?.[0];
		const inactive: IHttpRequestOptions = {
			url: '/pdf-with-added-tables',
			body: { tag_enabled: false, tag_language: 'stale' },
		};
		await preSend?.call(context(false), inactive);
		expect(inactive.body).toEqual({ tag_enabled: false });

		for (const tag_language of ['en-US', 'zh-Hant-TW', 'i-klingon', 'x-private']) {
			await expect(
				preSend?.call(context(true), {
					url: '/pdf-with-added-tables',
					body: { tag_enabled: true, tag_language },
				}),
			).resolves.toBeDefined();
		}
		for (const tag_language of ['', 'english_US', 'en--US']) {
			await expect(
				preSend?.call(context(true), {
					url: '/pdf-with-added-tables',
					body: { tag_enabled: true, tag_language },
				}),
			).rejects.toThrow('Tag Language must be a valid BCP 47 language tag');
		}
		await expect(
			preSend?.call(context('true'), {
				url: '/pdf-with-added-tables',
				body: { tag_enabled: 'true' },
			}),
		).rejects.toThrow('Tag Enabled must be a boolean');
		await expect(runTables(simpleTable, { tagEnabled: 'false' })).rejects.toThrow(
			'Tag Enabled must be a boolean',
		);
	});

	it('validates output and routes headers while omitting Response-Type by default', async () => {
		const output = getOptionalField('output');
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(context(), {
				url: '/pdf-with-added-tables',
				body: { output: '' },
			}),
		).rejects.toThrow('Output File Name must contain at least one character');

		const includeRequest: IHttpRequestOptions = { url: '/pdf-with-added-tables' };
		await getOptionalField('includeFileInfo')?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => false } as unknown as IExecuteSingleFunctions,
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseRequest: IHttpRequestOptions = {
			url: '/pdf-with-added-tables',
			headers: { 'Response-Type': '', Accept: 'application/json' },
		};
		expect(getOptionalField('responseType')).toMatchObject({ default: '' });
		await getOptionalField('responseType')?.routing?.send?.preSend?.[0]?.call(
			{ getNodeParameter: () => '' } as unknown as IExecuteSingleFunctions,
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});

	it('exposes exact JSON properties while hiding both multipart binary fields', () => {
		const definition = JSON.stringify(addTablesDescription);
		expect(definition).not.toContain('inputFileDataFieldName');
		expect(definition).not.toContain('Input File');
		expect(definition).not.toContain('image_files');
		expect(definition).not.toContain('"property":"file"');

		const bodyProperties = addTablesDescription.flatMap((field) => [
			...(field.routing?.send?.type === 'body' ? [field.routing.send.property] : []),
			...(field.options ?? []).flatMap((option) =>
				option.routing?.send?.type === 'body' ? [option.routing.send.property] : [],
			),
		]);
		expect(bodyProperties).toEqual([
			'id',
			'table_objects',
			'image_ids',
			'output',
			'tag_enabled',
			'tag_language',
		]);
	});
});
