import {
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type INodeProperties,
	type INodePropertyOptions,
	type PreSendAction,
} from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

type JsonObject = Record<string, unknown>;

const shapeObjectsExample = JSON.stringify(
	[
		{
			type: 'rectangle',
			page: 1,
			x: 54,
			y: 540,
			width: 504,
			height: 108,
			fill_color_rgb: '245,247,250',
			stroke_color_rgb: '26,72,112',
			stroke_width: 1,
		},
		{
			type: 'line',
			page: 1,
			x1: 72,
			y1: 576,
			x2: 540,
			y2: 576,
			stroke_color_rgb: '26,72,112',
			stroke_width: 1.5,
		},
	],
	null,
	2,
);

const commonShapeProperties = [
	'type',
	'page',
	'stroke_color_rgb',
	'stroke_color_cmyk',
	'stroke_width',
	'opacity',
	'tag_actual_text',
	'tag_is_artifact',
	'tag_structure_type',
] as const;

const lineProperties = [...commonShapeProperties, 'x1', 'y1', 'x2', 'y2'] as const;
const rectangleProperties = [
	...commonShapeProperties,
	'x',
	'y',
	'width',
	'height',
	'fill_color_rgb',
	'fill_color_cmyk',
] as const;

const contentStructureTypes = [
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
] as const;

const rgbColorPattern =
	/^\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*$/;
const cmykColorPattern =
	/^\s*(?:100|\d?\d)\s*,\s*(?:100|\d?\d)\s*,\s*(?:100|\d?\d)\s*,\s*(?:100|\d?\d)\s*$/;

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: JsonObject, property: string): boolean {
	return Object.prototype.hasOwnProperty.call(value, property);
}

function validateAllowedProperties(
	shape: JsonObject,
	allowedProperties: readonly string[],
	path: string,
): void {
	const unsupportedProperty = Object.keys(shape).find(
		(property) => !allowedProperties.includes(property),
	);
	if (unsupportedProperty) {
		throw new Error(`${path} contains unsupported property "${unsupportedProperty}".`);
	}
}

function validateNumber(
	shape: JsonObject,
	property: string,
	path: string,
	minimum: number,
	exclusive = false,
): void {
	const value = shape[property];
	if (
		typeof value !== 'number' ||
		!Number.isFinite(value) ||
		(exclusive ? value <= minimum : value < minimum)
	) {
		const comparison = exclusive ? 'greater than' : 'at least';
		throw new Error(`${path}.${property} must be a finite number ${comparison} ${minimum}.`);
	}
}

function validatePage(shape: JsonObject, path: string): void {
	const page = shape.page;
	if (page !== 'all' && (typeof page !== 'number' || !Number.isInteger(page) || page < 1)) {
		throw new Error(`${path}.page must be a positive integer or "all".`);
	}
}

function validateColor(
	shape: JsonObject,
	property: string,
	pattern: RegExp,
	colorModel: 'CMYK' | 'RGB',
	path: string,
): void {
	if (!hasOwn(shape, property)) {
		return;
	}
	if (typeof shape[property] !== 'string' || !pattern.test(shape[property])) {
		throw new Error(`${path}.${property} must be a valid ${colorModel} color string.`);
	}
}

function validateExclusiveColors(
	shape: JsonObject,
	rgbProperty: string,
	cmykProperty: string,
	path: string,
): void {
	if (hasOwn(shape, rgbProperty) && hasOwn(shape, cmykProperty)) {
		throw new Error(`${path} cannot contain both ${rgbProperty} and ${cmykProperty}.`);
	}
}

function validateCommonShapeProperties(shape: JsonObject, path: string, tagEnabled: boolean): void {
	validatePage(shape, path);
	validateColor(shape, 'stroke_color_rgb', rgbColorPattern, 'RGB', path);
	validateColor(shape, 'stroke_color_cmyk', cmykColorPattern, 'CMYK', path);
	validateExclusiveColors(shape, 'stroke_color_rgb', 'stroke_color_cmyk', path);

	if (hasOwn(shape, 'stroke_width')) {
		validateNumber(shape, 'stroke_width', path, 0, true);
	}
	if (hasOwn(shape, 'opacity')) {
		validateNumber(shape, 'opacity', path, 0);
		if ((shape.opacity as number) > 1) {
			throw new Error(`${path}.opacity must be no greater than 1.`);
		}
	}

	if (hasOwn(shape, 'tag_actual_text')) {
		if (typeof shape.tag_actual_text !== 'string' || shape.tag_actual_text.length < 1) {
			throw new Error(`${path}.tag_actual_text must contain at least one character.`);
		}
	}
	if (hasOwn(shape, 'tag_is_artifact') && typeof shape.tag_is_artifact !== 'boolean') {
		throw new Error(`${path}.tag_is_artifact must be a boolean.`);
	}
	if (
		hasOwn(shape, 'tag_structure_type') &&
		(typeof shape.tag_structure_type !== 'string' ||
			!contentStructureTypes.includes(shape.tag_structure_type as never))
	) {
		throw new Error(`${path}.tag_structure_type must be a supported PDF structure type.`);
	}

	const hasTagProperty = ['tag_actual_text', 'tag_is_artifact', 'tag_structure_type'].some(
		(property) => hasOwn(shape, property),
	);
	if (hasTagProperty && !tagEnabled) {
		throw new Error(`${path} tag properties require Tag Enabled to be true.`);
	}
}

function validateLine(shape: JsonObject, path: string, tagEnabled: boolean): void {
	validateAllowedProperties(shape, lineProperties, path);
	for (const property of ['x1', 'y1', 'x2', 'y2']) {
		validateNumber(shape, property, path, 0);
	}
	validateCommonShapeProperties(shape, path, tagEnabled);
}

function validateRectangle(shape: JsonObject, path: string, tagEnabled: boolean): void {
	validateAllowedProperties(shape, rectangleProperties, path);
	validateNumber(shape, 'x', path, 0);
	validateNumber(shape, 'y', path, 0);
	validateNumber(shape, 'width', path, 0, true);
	validateNumber(shape, 'height', path, 0, true);
	validateColor(shape, 'fill_color_rgb', rgbColorPattern, 'RGB', path);
	validateColor(shape, 'fill_color_cmyk', cmykColorPattern, 'CMYK', path);
	validateExclusiveColors(shape, 'fill_color_rgb', 'fill_color_cmyk', path);
	validateCommonShapeProperties(shape, path, tagEnabled);
}

function validateShape(value: unknown, index: number, tagEnabled: boolean): void {
	const path = `Shape Objects item ${index + 1}`;
	if (!isObject(value)) {
		throw new Error(`${path} must be an object.`);
	}

	if (value.type === 'line') {
		validateLine(value, path, tagEnabled);
		return;
	}
	if (value.type === 'rectangle') {
		validateRectangle(value, path, tagEnabled);
		return;
	}
	throw new Error(`${path}.type must be "line" or "rectangle".`);
}

function createShapeObjectsPreSend(): PreSendAction {
	return async function serializeShapeObjects(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const rawValue = isObject(body) ? body.shape_objects : undefined;
		const rawTagEnabled = this.getNodeParameter('options.tagEnabled', false);

		try {
			if (typeof rawTagEnabled !== 'boolean') {
				throw new Error('Tag Enabled must be a boolean.');
			}
			const shapeObjects = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
			const shapes = Array.isArray(shapeObjects) ? shapeObjects : [shapeObjects];
			if (shapes.length < 1) {
				throw new Error('Shape Objects must contain at least one shape.');
			}
			shapes.forEach((shape, index) => validateShape(shape, index, rawTagEnabled));
			requestOptions.body = {
				...(body as IDataObject),
				shape_objects: shapeObjects,
			};
			return requestOptions;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Shape Objects contains invalid JSON.';
			throw new NodeOperationError(this.getNode(), message);
		}
	};
}

function createTagEnabledPreSend(): PreSendAction {
	return async function validateTagEnabled(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const tagEnabled = this.getNodeParameter('options.tagEnabled', false);
		if (typeof tagEnabled !== 'boolean') {
			throw new NodeOperationError(this.getNode(), 'Tag Enabled must be a boolean.');
		}
		return requestOptions;
	};
}

export const addShapesOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Add Shapes to PDF',
	value: 'addShapes',
	action: 'Modify · Add Shapes to PDF',
	description: 'Draw lines and rectangles in a PDF for separators, boxes, fills, and borders',
	path: '/pdf-with-added-shapes',
});

export const addShapesDescription: INodeProperties[] = [
	createResourceIdField('addShapes'),
	{
		displayName: 'Shape Objects',
		name: 'shapeObjects',
		type: 'json',
		default: shapeObjectsExample,
		required: true,
		displayOptions: {
			show: {
				operation: ['addShapes'],
			},
		},
		description: 'A JSON line or rectangle object, or an array of those shape objects',
		routing: {
			send: {
				type: 'body',
				property: 'shape_objects',
				preSend: [createShapeObjectsPreSend()],
			},
		},
	},
	{
		displayName:
			'Shape Objects documentation: <a href="https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/add-to-pdf/POST/pdf-with-added-shapes.body.shape_objects/" target="_blank">Learn how to build the object</a>',
		name: 'shapeObjectsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { operation: ['addShapes'] } },
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['addShapes'],
			},
		},
		options: [
			createIncludeFileInfoField('addShapes'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated PDF without an extension',
			}),
			createResponseTypeField('addShapes'),
			{
				displayName: 'Tag Enabled',
				name: 'tagEnabled',
				type: 'boolean',
				default: false,
				description: 'Whether to tag shapes added by this request for accessibility',
				routing: {
					send: {
						type: 'body',
						property: 'tag_enabled',
						preSend: [createTagEnabledPreSend()],
					},
				},
			},
		],
	},
];
