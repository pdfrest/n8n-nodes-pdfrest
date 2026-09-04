import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type INodeProperties,
	type INodePropertyOptions,
	type PreSendAction,
} from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

type JsonObject = Record<string, unknown>;

const tableObjectsExample = JSON.stringify(
	[
		{
			page: 1,
			x: 54,
			y: 540,
			width: 504,
			columns: [{ width: 252 }, { width: 252 }],
			header_rows: [{ cells: [{ text: 'Milestone' }, { text: 'Status' }] }],
			rows: [
				{
					cells: [
						{ text: 'Requirements review' },
						{ text: 'Complete' },
					],
				},
			],
		},
	],
	null,
	2,
);

interface ValidationState {
	imageIds: string[];
	tagEnabled: boolean;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rgbPattern =
	/^\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*$/;
const cmykPattern =
	/^\s*(?:100|\d?\d)\s*,\s*(?:100|\d?\d)\s*,\s*(?:100|\d?\d)\s*,\s*(?:100|\d?\d)\s*$/;
const languageTagPattern =
	/^(?:(?:[a-z]{2,3}(?:-[a-z]{3}){0,3}|[a-z]{4}|[a-z]{5,8})(?:-[a-z]{4})?(?:-(?:[a-z]{2}|\d{3}))?(?:-(?:[a-z0-9]{5,8}|\d[a-z0-9]{3}))*(?:-[0-9a-wy-z](?:-[a-z0-9]{2,8})+)*(?:-x(?:-[a-z0-9]{1,8})+)?|x(?:-[a-z0-9]{1,8})+)$/i;
const grandfatheredLanguageTags = new Set([
	'art-lojban',
	'cel-gaulish',
	'en-gb-oed',
	'i-ami',
	'i-bnn',
	'i-default',
	'i-enochian',
	'i-hak',
	'i-klingon',
	'i-lux',
	'i-mingo',
	'i-navajo',
	'i-pwn',
	'i-tao',
	'i-tay',
	'i-tsu',
	'no-bok',
	'no-nyn',
	'sgn-be-fr',
	'sgn-be-nl',
	'sgn-ch-de',
	'zh-guoyu',
	'zh-hakka',
	'zh-min',
	'zh-min-nan',
	'zh-xiang',
]);

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: JsonObject, property: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, property);
}

function assertObject(value: unknown, path: string): asserts value is JsonObject {
	if (!isObject(value)) throw new Error(`${path} must be an object.`);
}

function assertAllowed(value: JsonObject, allowed: string[], path: string): void {
	const unsupported = Object.keys(value).find((property) => !allowed.includes(property));
	if (unsupported) throw new Error(`${path} contains unsupported property "${unsupported}".`);
}

function assertNumber(
	value: JsonObject,
	property: string,
	path: string,
	options: {
		required?: boolean;
		integer?: boolean;
		minimum?: number;
		exclusiveMinimum?: number;
		maximum?: number;
	} = {},
): void {
	const input = value[property];
	if (input === undefined && !options.required && !hasOwn(value, property)) return;
	if (
		typeof input !== 'number' ||
		!Number.isFinite(input) ||
		(options.integer === true && !Number.isInteger(input)) ||
		(options.minimum !== undefined && input < options.minimum) ||
		(options.exclusiveMinimum !== undefined && input <= options.exclusiveMinimum) ||
		(options.maximum !== undefined && input > options.maximum)
	) {
		throw new Error(`${path}.${property} has an invalid numeric value.`);
	}
}

function assertBoolean(value: JsonObject, property: string, path: string): void {
	if (hasOwn(value, property) && typeof value[property] !== 'boolean') {
		throw new Error(`${path}.${property} must be a boolean.`);
	}
}

function assertEnum(value: JsonObject, property: string, allowed: string[], path: string): void {
	if (hasOwn(value, property) && !allowed.includes(value[property] as string)) {
		throw new Error(`${path}.${property} has an unsupported value.`);
	}
}

function requireTagging(
	value: JsonObject,
	properties: string[],
	path: string,
	state: ValidationState,
): void {
	if (!state.tagEnabled && properties.some((property) => hasOwn(value, property))) {
		throw new Error(`${path} tag properties require Tag Enabled to be true.`);
	}
}

function validateColor(value: unknown, channels: 3 | 4, path: string): void {
	if (typeof value === 'string') {
		if (!(channels === 3 ? rgbPattern : cmykPattern).test(value)) {
			throw new Error(`${path} has invalid color channels.`);
		}
		return;
	}
	if (
		!Array.isArray(value) ||
		value.length !== channels ||
		!value.every(
			(channel) =>
				typeof channel === 'number' &&
				Number.isFinite(channel) &&
				channel >= 0 &&
				channel <= (channels === 3 ? 255 : 100) &&
				(channels === 4 || Number.isInteger(channel)),
		)
	) {
		throw new Error(`${path} has invalid color channels.`);
	}
}

function validatePadding(value: unknown, path: string): void {
	assertObject(value, path);
	assertAllowed(value, ['top', 'right', 'bottom', 'left'], path);
	for (const side of ['top', 'right', 'bottom', 'left']) {
		assertNumber(value, side, path, { minimum: 0 });
	}
}

function validateBorderSide(value: unknown, path: string): void {
	assertObject(value, path);
	assertAllowed(value, ['width', 'color_rgb', 'color_cmyk', 'opacity'], path);
	assertNumber(value, 'width', path, { minimum: 0 });
	assertNumber(value, 'opacity', path, { minimum: 0, maximum: 1 });
	if (hasOwn(value, 'color_rgb') && hasOwn(value, 'color_cmyk')) {
		throw new Error(`${path} cannot contain both RGB and CMYK colors.`);
	}
	if (hasOwn(value, 'color_rgb')) validateColor(value.color_rgb, 3, `${path}.color_rgb`);
	if (hasOwn(value, 'color_cmyk')) validateColor(value.color_cmyk, 4, `${path}.color_cmyk`);
}

function validateBorder(value: unknown, path: string): void {
	assertObject(value, path);
	assertAllowed(value, ['top', 'right', 'bottom', 'left'], path);
	for (const side of ['top', 'right', 'bottom', 'left']) {
		if (hasOwn(value, side)) validateBorderSide(value[side], `${path}.${side}`);
	}
}

function validateStyle(value: unknown, path: string): void {
	assertObject(value, path);
	assertAllowed(
		value,
		[
			'font',
			'text_size',
			'text_align',
			'vertical_align',
			'text_color_rgb',
			'text_color_cmyk',
			'background_color_rgb',
			'background_color_cmyk',
			'opacity',
			'padding',
			'border',
		],
		path,
	);
	if (hasOwn(value, 'font') && typeof value.font !== 'string') {
		throw new Error(`${path}.font must be a string.`);
	}
	assertNumber(value, 'text_size', path, { exclusiveMinimum: 0 });
	assertNumber(value, 'opacity', path, { minimum: 0, maximum: 1 });
	assertEnum(value, 'text_align', ['left', 'center', 'right'], path);
	assertEnum(value, 'vertical_align', ['top', 'middle', 'bottom'], path);
	for (const [rgb, cmyk] of [
		['text_color_rgb', 'text_color_cmyk'],
		['background_color_rgb', 'background_color_cmyk'],
	] as const) {
		if (hasOwn(value, rgb) && hasOwn(value, cmyk)) {
			throw new Error(`${path} cannot contain both ${rgb} and ${cmyk}.`);
		}
		if (hasOwn(value, rgb)) validateColor(value[rgb], 3, `${path}.${rgb}`);
		if (hasOwn(value, cmyk)) validateColor(value[cmyk], 4, `${path}.${cmyk}`);
	}
	if (hasOwn(value, 'padding')) validatePadding(value.padding, `${path}.padding`);
	if (hasOwn(value, 'border')) validateBorder(value.border, `${path}.border`);
}

function validateCellImage(value: unknown, path: string, state: ValidationState): void {
	assertObject(value, path);
	assertAllowed(
		value,
		['image_index', 'width', 'height', 'tag_alt_text', 'tag_is_artifact', 'tag_structure_type'],
		path,
	);
	assertNumber(value, 'image_index', path, { required: true, integer: true, minimum: 0 });
	assertNumber(value, 'width', path, { exclusiveMinimum: 0 });
	assertNumber(value, 'height', path, { exclusiveMinimum: 0 });
	if (
		hasOwn(value, 'tag_alt_text') &&
		(typeof value.tag_alt_text !== 'string' || value.tag_alt_text.length < 1)
	) {
		throw new Error(`${path}.tag_alt_text must contain at least one character.`);
	}
	assertBoolean(value, 'tag_is_artifact', path);
	if (hasOwn(value, 'tag_structure_type') && value.tag_structure_type !== 'Figure') {
		throw new Error(`${path}.tag_structure_type must be Figure.`);
	}
	requireTagging(value, ['tag_alt_text', 'tag_is_artifact', 'tag_structure_type'], path, state);
	if ((value.image_index as number) >= state.imageIds.length) {
		throw new Error(`${path}.image_index must reference an available Image Resource ID.`);
	}
}

function validateCell(
	value: unknown,
	path: string,
	state: ValidationState,
): { colSpan: number; rowSpan: number } {
	assertObject(value, path);
	assertAllowed(
		value,
		[
			'text',
			'image',
			'col_span',
			'row_span',
			'min_height',
			'fixed_height',
			'no_wrap',
			'is_rtl',
			'style',
			'tag_actual_text',
			'tag_structure_type',
		],
		path,
	);
	if (hasOwn(value, 'text') && hasOwn(value, 'image')) {
		throw new Error(`${path} cannot contain both text and image.`);
	}
	if (hasOwn(value, 'text') && typeof value.text !== 'string') {
		throw new Error(`${path}.text must be a string.`);
	}
	if (hasOwn(value, 'image')) validateCellImage(value.image, `${path}.image`, state);
	assertNumber(value, 'col_span', path, { integer: true, minimum: 1 });
	assertNumber(value, 'row_span', path, { integer: true, minimum: 1 });
	assertNumber(value, 'min_height', path, { minimum: 0 });
	assertNumber(value, 'fixed_height', path, { minimum: 0 });
	if (
		typeof value.min_height === 'number' &&
		typeof value.fixed_height === 'number' &&
		value.fixed_height < value.min_height
	) {
		throw new Error(`${path}.fixed_height cannot be less than min_height.`);
	}
	assertBoolean(value, 'no_wrap', path);
	assertBoolean(value, 'is_rtl', path);
	if (hasOwn(value, 'style')) validateStyle(value.style, `${path}.style`);
	if (
		hasOwn(value, 'tag_actual_text') &&
		(typeof value.tag_actual_text !== 'string' || value.tag_actual_text.length < 1)
	) {
		throw new Error(`${path}.tag_actual_text must contain at least one character.`);
	}
	assertEnum(value, 'tag_structure_type', ['TH', 'TD'], path);
	requireTagging(value, ['tag_actual_text', 'tag_structure_type'], path, state);
	return {
		colSpan: typeof value.col_span === 'number' ? value.col_span : 1,
		rowSpan: typeof value.row_span === 'number' ? value.row_span : 1,
	};
}

function validateRow(
	value: unknown,
	path: string,
	state: ValidationState,
): Array<{ colSpan: number; rowSpan: number }> {
	assertObject(value, path);
	assertAllowed(value, ['cells', 'min_height', 'style'], path);
	if (!Array.isArray(value.cells) || value.cells.length < 1) {
		throw new Error(`${path}.cells must contain at least one item.`);
	}
	const spans = value.cells.map((cell, index) =>
		validateCell(cell, `${path}.cells[${index}]`, state),
	);
	assertNumber(value, 'min_height', path, { minimum: 0 });
	if (hasOwn(value, 'style')) validateStyle(value.style, `${path}.style`);
	return spans;
}

function validateRows(
	value: JsonObject,
	property: string,
	path: string,
	state: ValidationState,
	columnCount: number,
	required: boolean,
): void {
	const rows = value[property];
	if (rows === undefined && !required) return;
	if (!Array.isArray(rows) || rows.length < 1) {
		throw new Error(`${path}.${property} must contain at least one row.`);
	}
	let activeRowSpans = Array<number>(columnCount).fill(0);
	rows.forEach((row, index) => {
		const rowPath = `${path}.${property}[${index}]`;
		const spans = validateRow(row, rowPath, state);
		const occupied = activeRowSpans.map((remaining) => remaining > 0);
		const newRowSpans = Array<number>(columnCount).fill(0);
		let column = 0;
		for (const { colSpan, rowSpan } of spans) {
			while (column < columnCount && occupied[column]) column += 1;
			if (
				column + colSpan > columnCount ||
				occupied.slice(column, column + colSpan).some(Boolean)
			) {
				throw new Error(`${rowPath}.cells contains an overlapping or out-of-range span.`);
			}
			for (let offset = 0; offset < colSpan; offset += 1) {
				occupied[column + offset] = true;
				newRowSpans[column + offset] = rowSpan - 1;
			}
			column += colSpan;
		}
		if (occupied.some((isOccupied) => !isOccupied)) {
			throw new Error(`${rowPath}.cells must resolve to exactly ${columnCount} columns.`);
		}
		activeRowSpans = activeRowSpans.map((remaining, columnIndex) =>
			Math.max(remaining - 1, newRowSpans[columnIndex]),
		);
	});
	if (activeRowSpans.some((remaining) => remaining > 0)) {
		throw new Error(`${path}.${property} contains a row span that crosses its table section.`);
	}
}

function validateTable(value: unknown, index: number, state: ValidationState): void {
	const path = `Table Objects item ${index + 1}`;
	assertObject(value, path);
	assertAllowed(
		value,
		[
			'page',
			'x',
			'y',
			'width',
			'width_percentage',
			'width_mode',
			'horizontal_align',
			'is_rtl',
			'keep_table_block_together',
			'spacing_before',
			'spacing_after',
			'continuation_page_top_margin',
			'page_bottom_margin',
			'final_page_bottom_margin',
			'overflow_behavior',
			'row_split_behavior',
			'repeat_header_on_overflow',
			'repeat_footer_on_overflow',
			'show_header_on_first_page',
			'show_footer_on_last_page',
			'columns',
			'header_rows',
			'rows',
			'footer_rows',
			'style',
			'tag_is_artifact',
			'tag_structure_type',
		],
		path,
	);
	assertNumber(value, 'page', path, { required: true, integer: true, minimum: 1 });
	assertNumber(value, 'x', path, { minimum: 0 });
	assertNumber(value, 'y', path, { required: true, minimum: 0 });
	assertNumber(value, 'width', path, { exclusiveMinimum: 0 });
	assertNumber(value, 'width_percentage', path, { exclusiveMinimum: 0, maximum: 100 });
	if ((value.width !== undefined) === (value.width_percentage !== undefined)) {
		throw new Error(`${path} must contain exactly one of width or width_percentage.`);
	}
	if (value.x === undefined && value.horizontal_align === undefined) {
		throw new Error(`${path} must contain x or horizontal_align.`);
	}
	assertEnum(value, 'width_mode', ['fixed', 'relative'], path);
	assertEnum(value, 'horizontal_align', ['left', 'center', 'right'], path);
	if (hasOwn(value, 'width_percentage') && value.width_mode !== 'relative') {
		throw new Error(`${path}.width_percentage requires width_mode to be relative.`);
	}
	for (const property of [
		'is_rtl',
		'keep_table_block_together',
		'repeat_header_on_overflow',
		'repeat_footer_on_overflow',
		'show_header_on_first_page',
		'show_footer_on_last_page',
	]) {
		assertBoolean(value, property, path);
	}
	assertNumber(value, 'spacing_before', path, { minimum: 0 });
	assertNumber(value, 'spacing_after', path, { minimum: 0 });
	assertNumber(value, 'continuation_page_top_margin', path, { minimum: 0 });
	assertNumber(value, 'page_bottom_margin', path, { minimum: 0 });
	assertNumber(value, 'final_page_bottom_margin', path, { minimum: 0 });
	if (
		typeof value.final_page_bottom_margin === 'number' &&
		value.final_page_bottom_margin <
			(typeof value.page_bottom_margin === 'number' ? value.page_bottom_margin : 0)
	) {
		throw new Error(`${path}.final_page_bottom_margin cannot be less than page_bottom_margin.`);
	}
	assertEnum(value, 'overflow_behavior', ['move-row', 'split-row', 'fail'], path);
	assertEnum(value, 'row_split_behavior', ['split-when-needed', 'prefer-next-page'], path);
	if (!Array.isArray(value.columns) || value.columns.length < 1) {
		throw new Error(`${path}.columns must contain at least one item.`);
	}
	let columnWidthTotal = 0;
	value.columns.forEach((column, columnIndex) => {
		const columnPath = `${path}.columns[${columnIndex}]`;
		assertObject(column, columnPath);
		assertAllowed(column, ['width', 'style'], columnPath);
		assertNumber(column, 'width', columnPath, { required: true, exclusiveMinimum: 0 });
		columnWidthTotal += column.width as number;
		if (hasOwn(column, 'style')) validateStyle(column.style, `${columnPath}.style`);
	});
	if (
		(value.width_mode === undefined || value.width_mode === 'fixed') &&
		typeof value.width === 'number' &&
		Math.abs(columnWidthTotal - value.width) > 1e-9
	) {
		throw new Error(`${path} fixed column widths must total the table width.`);
	}
	validateRows(value, 'header_rows', path, state, value.columns.length, false);
	validateRows(value, 'rows', path, state, value.columns.length, true);
	validateRows(value, 'footer_rows', path, state, value.columns.length, false);
	if (hasOwn(value, 'style')) validateStyle(value.style, `${path}.style`);
	assertBoolean(value, 'tag_is_artifact', path);
	if (hasOwn(value, 'tag_structure_type') && value.tag_structure_type !== 'Table') {
		throw new Error(`${path}.tag_structure_type must be Table.`);
	}
	requireTagging(value, ['tag_is_artifact', 'tag_structure_type'], path, state);
}

function getImageIds(context: IExecuteSingleFunctions): string[] {
	const rawImageIds = context.getNodeParameter('options.imageResourceIds', []);
	if (!Array.isArray(rawImageIds)) {
		throw new NodeOperationError(context.getNode(), 'Image Resource IDs must be an ordered list.');
	}
	const imageIds: string[] = [];
	for (const [index, imageId] of rawImageIds.entries()) {
		if (typeof imageId !== 'string' || !uuidPattern.test(imageId)) {
			throw new NodeOperationError(
				context.getNode(),
				`Image Resource ID ${index + 1} must be a valid UUID.`,
			);
		}
		imageIds.push(imageId);
	}
	return imageIds;
}

function createTableObjectsPreSend(): PreSendAction {
	return async function serializeTableObjects(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = isObject(requestOptions.body) ? requestOptions.body : {};
		const rawValue = body.table_objects;
		const imageIds = getImageIds(this);
		const tagEnabled = this.getNodeParameter('options.tagEnabled', false);
		if (typeof tagEnabled !== 'boolean') {
			throw new NodeOperationError(this.getNode(), 'Tag Enabled must be a boolean.');
		}
		const state = {
			imageIds,
			tagEnabled,
		};
		try {
			const tableObjects = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
			const tables = Array.isArray(tableObjects) ? tableObjects : [tableObjects];
			if (tables.length < 1 || tableObjects === undefined || tableObjects === null) {
				throw new Error('Table Objects must contain at least one table.');
			}
			tables.forEach((table, index) => validateTable(table, index, state));
			const nextBody: IDataObject = { ...body, table_objects: tableObjects };
			if (imageIds.length > 0) nextBody.image_ids = imageIds;
			else delete nextBody.image_ids;
			requestOptions.body = nextBody;
			return requestOptions;
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				error instanceof Error ? error.message : 'Table Objects contains invalid JSON.',
			);
		}
	};
}

function createTaggingPreSend(): PreSendAction {
	return async function prepareTagging(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const tagEnabled = this.getNodeParameter('options.tagEnabled', false);
		if (typeof tagEnabled !== 'boolean') {
			throw new NodeOperationError(this.getNode(), 'Tag Enabled must be a boolean.');
		}
		if (!isObject(requestOptions.body)) return requestOptions;
		const nextBody = { ...requestOptions.body };
		if (!tagEnabled) {
			delete nextBody.tag_language;
			requestOptions.body = nextBody;
			return requestOptions;
		}
		if (
			nextBody.tag_language !== undefined &&
			(typeof nextBody.tag_language !== 'string' ||
				nextBody.tag_language.length < 1 ||
				(!grandfatheredLanguageTags.has(nextBody.tag_language.toLowerCase()) &&
					!languageTagPattern.test(nextBody.tag_language)))
		) {
			throw new NodeOperationError(
				this.getNode(),
				'Tag Language must be a valid BCP 47 language tag.',
			);
		}
		return requestOptions;
	};
}

export const addTablesOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Add Tables to PDF',
	value: 'addTables',
	action: 'Modify · Add Tables to PDF',
	description:
		'Insert styled tables into a PDF with support for spans, images, and continuation pages',
	path: '/pdf-with-added-tables',
});

export const addTablesDescription: INodeProperties[] = [
	createResourceIdField('addTables'),
	{
		displayName: 'Table Objects',
		name: 'tableObjects',
		type: 'json',
		default: tableObjectsExample,
		required: true,
		displayOptions: { show: { operation: ['addTables'] } },
		description: 'A JSON table object or array of table objects to add to the PDF',
		routing: {
			send: {
				type: 'body',
				property: 'table_objects',
				preSend: [createTableObjectsPreSend()],
			},
		},
	},
	{
		displayName:
			'Table Objects documentation: <a href="https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/add-to-pdf/POST/pdf-with-added-tables.body.table_objects/" target="_blank">Learn how to build the object</a>',
		name: 'tableObjectsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { operation: ['addTables'] } },
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: ['addTables'] } },
		options: [
			{
				displayName: 'Image Resource IDs',
				name: 'imageResourceIds',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Image Resource ID',
				},
				default: [],
				description: 'Ordered resource IDs for images referenced by zero-based image indexes',
				routing: { send: { type: 'body', property: 'image_ids' } },
			},
			createIncludeFileInfoField('addTables'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated PDF without an extension',
			}),
			createResponseTypeField('addTables'),
			{
				displayName: 'Tag Enabled',
				name: 'tagEnabled',
				type: 'boolean',
				default: false,
				description: 'Whether to tag table content added by this request for accessibility',
				routing: {
					send: {
						type: 'body',
						property: 'tag_enabled',
						preSend: [createTaggingPreSend()],
					},
				},
			},
			{
				displayName: 'Tag Language',
				name: 'tagLanguage',
				type: 'string',
				default: 'en-US',
				displayOptions: { show: { tagEnabled: [true] } },
				description: 'The BCP 47 language tag for newly added tagged table content',
				routing: {
					send: {
						type: 'body',
						property: 'tag_language',
						preSend: [createTaggingPreSend()],
					},
				},
			},
		],
	},
];
