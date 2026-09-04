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

const pageBoxDefinitionsExample = JSON.stringify(
	{
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
	},
	null,
	2,
);

const pageBoxTypes = ['media', 'crop', 'bleed', 'trim', 'art'] as const;
const pageRangePattern = /^(?:all|even|odd|[1-9][0-9]*|[1-9][0-9]*-(?:[1-9][0-9]*|last))$/;
const marginProperties = ['top', 'bottom', 'left', 'right'] as const;

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateAllowedProperties(
	value: JsonObject,
	allowedProperties: readonly string[],
	path: string,
): void {
	const unsupportedProperty = Object.keys(value).find(
		(property) => !allowedProperties.includes(property),
	);
	if (unsupportedProperty) {
		throw new Error(`${path} contains unsupported property "${unsupportedProperty}".`);
	}
}

function validatePageDefinition(value: unknown, boxType: string, path: string): void {
	if (!isObject(value)) {
		throw new Error(`${path} must be an object.`);
	}
	validateAllowedProperties(value, ['range', ...marginProperties], path);

	if (typeof value.range !== 'string' || !pageRangePattern.test(value.range)) {
		throw new Error(`${path}.range must be a supported page or page-range expression.`);
	}

	for (const property of marginProperties) {
		const margin = value[property];
		if (typeof margin !== 'number' || !Number.isFinite(margin)) {
			throw new Error(`${path}.${property} must be a finite number.`);
		}
		if (boxType !== 'media' && margin <= 0) {
			throw new Error(`${path}.${property} must be greater than 0 for ${boxType} page boxes.`);
		}
	}
}

function validatePageBox(value: unknown, index: number): void {
	const path = `Page Box Definitions.boxes item ${index + 1}`;
	if (!isObject(value)) {
		throw new Error(`${path} must be an object.`);
	}
	validateAllowedProperties(value, ['box', 'pages'], path);

	if (
		typeof value.box !== 'string' ||
		!pageBoxTypes.includes(value.box as (typeof pageBoxTypes)[number])
	) {
		throw new Error(`${path}.box must be media, crop, bleed, trim, or art.`);
	}
	if (!Array.isArray(value.pages) || value.pages.length < 1) {
		throw new Error(`${path}.pages must be an array containing at least one item.`);
	}

	value.pages.forEach((page, pageIndex) =>
		validatePageDefinition(page, value.box as string, `${path}.pages item ${pageIndex + 1}`),
	);
}

function validatePageBoxDefinitions(value: unknown): asserts value is JsonObject {
	if (!isObject(value)) {
		throw new Error('Page Box Definitions must be an object.');
	}
	validateAllowedProperties(value, ['boxes'], 'Page Box Definitions');
	if (!Array.isArray(value.boxes) || value.boxes.length < 1) {
		throw new Error('Page Box Definitions.boxes must be an array containing at least one item.');
	}
	value.boxes.forEach(validatePageBox);
}

function createPageBoxDefinitionsPreSend(): PreSendAction {
	return async function serializePageBoxDefinitions(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const rawValue = isObject(body) ? body.boxes : undefined;

		try {
			const definitions = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
			validatePageBoxDefinitions(definitions);
			requestOptions.body = {
				...(body as IDataObject),
				boxes: JSON.stringify(definitions),
			};
			return requestOptions;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Page Box Definitions contains invalid JSON.';
			throw new NodeOperationError(this.getNode(), message);
		}
	};
}

export const setPageBoxesOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Set PDF Page Boxes',
	value: 'setPageBoxes',
	action: 'Modify · Set Page Boxes (Crop, Trim)',
	description: 'Set PDF page boundaries for media, cropping, bleed, trimming, or artwork',
	path: '/pdf-with-page-boxes-set',
});

export const setPageBoxesDescription: INodeProperties[] = [
	createResourceIdField('setPageBoxes'),
	{
		displayName: 'Page Box Definitions',
		name: 'pageBoxDefinitions',
		type: 'json',
		default: pageBoxDefinitionsExample,
		required: true,
		displayOptions: {
			show: {
				operation: ['setPageBoxes'],
			},
		},
		description:
			'A JSON object defining media, crop, bleed, trim, or art page boxes and their page margins',
		routing: {
			send: {
				type: 'body',
				property: 'boxes',
				preSend: [createPageBoxDefinitionsPreSend()],
			},
		},
	},
	{
		displayName:
			'Page Box Definitions documentation: <a href="https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/set-page-boxes/POST/pdf-with-page-boxes-set.body.boxes/" target="_blank">Learn how to build the object</a>',
		name: 'pageBoxDefinitionsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { operation: ['setPageBoxes'] } },
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['setPageBoxes'],
			},
		},
		options: [
			createIncludeFileInfoField('setPageBoxes'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated PDF without an extension',
			}),
			createResponseTypeField('setPageBoxes'),
		],
	},
];
