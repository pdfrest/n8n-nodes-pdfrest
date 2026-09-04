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

const standardPageSizes = ['letter', 'legal', 'ledger', 'A3', 'A4', 'A5'] as const;

function createPageSizePreSend(): PreSendAction {
	return async function preparePageSizeBranch(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const pageSize = this.getNodeParameter('pageSize', 'letter');
		const body = requestOptions.body;
		const nextBody =
			body && typeof body === 'object' && !Array.isArray(body) ? { ...(body as IDataObject) } : {};
		const pageCount = nextBody.page_count;

		if (
			typeof pageCount !== 'number' ||
			!Number.isInteger(pageCount) ||
			pageCount < 1 ||
			pageCount > 1000
		) {
			throw new NodeOperationError(
				this.getNode(),
				'Page Count must be an integer from 1 through 1000.',
			);
		}

		if (pageSize === 'custom') {
			for (const [property, displayName] of [
				['custom_height', 'Custom Height'],
				['custom_width', 'Custom Width'],
			] as const) {
				const value = nextBody[property];
				if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
					throw new NodeOperationError(
						this.getNode(),
						`${displayName} must be a number greater than zero for a custom page size.`,
					);
				}
			}
			delete nextBody.page_orientation;
		} else if (standardPageSizes.includes(pageSize as (typeof standardPageSizes)[number])) {
			if (nextBody.page_orientation !== 'landscape' && nextBody.page_orientation !== 'portrait') {
				throw new NodeOperationError(
					this.getNode(),
					'Page Orientation is required for a standard page size.',
				);
			}
			delete nextBody.custom_height;
			delete nextBody.custom_width;
		} else {
			throw new NodeOperationError(this.getNode(), 'Page Size has an invalid value.');
		}

		requestOptions.body = nextBody;
		return requestOptions;
	};
}

export const blankPdfOperation: INodePropertyOptions = {
	name: 'Create Blank PDF',
	value: 'blankPdf',
	action: 'Modify · Create Blank PDF',
	description: 'Create a blank PDF with a defined page size, page count, and orientation',
	routing: {
		request: {
			method: 'POST',
			url: '/blank-pdf',
			headers: {
				'Content-Type': 'application/json',
			},
		},
	},
};

export const blankPdfDescription: INodeProperties[] = [
	{
		displayName: 'Page Count',
		name: 'pageCount',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000, numberPrecision: 0 },
		default: 1,
		required: true,
		displayOptions: { show: { operation: ['blankPdf'] } },
		description: 'The number of pages to create, from 1 through 1000',
		routing: { send: { type: 'body', property: 'page_count' } },
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'A3', value: 'A3' },
			{ name: 'A4', value: 'A4' },
			{ name: 'A5', value: 'A5' },
			{ name: 'Custom', value: 'custom' },
			{ name: 'Ledger', value: 'ledger' },
			{ name: 'Legal', value: 'legal' },
			{ name: 'Letter', value: 'letter' },
		],
		default: 'letter',
		required: true,
		displayOptions: { show: { operation: ['blankPdf'] } },
		description: 'The standard page size or a custom size in PDF units',
		routing: {
			send: {
				type: 'body',
				property: 'page_size',
				preSend: [createPageSizePreSend()],
			},
		},
	},
	{
		displayName: 'Page Orientation',
		name: 'pageOrientation',
		type: 'options',
		options: [
			{ name: 'Landscape', value: 'landscape' },
			{ name: 'Portrait', value: 'portrait' },
		],
		default: 'portrait',
		required: true,
		displayOptions: {
			show: {
				operation: ['blankPdf'],
				pageSize: [...standardPageSizes],
			},
		},
		description: 'The orientation of a standard page size',
		routing: { send: { type: 'body', property: 'page_orientation' } },
	},
	{
		displayName: 'Custom Height',
		name: 'customHeight',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 792,
		required: true,
		displayOptions: { show: { operation: ['blankPdf'], pageSize: ['custom'] } },
		description: 'The custom page height as a positive number of PDF units',
		routing: { send: { type: 'body', property: 'custom_height' } },
	},
	{
		displayName: 'Custom Width',
		name: 'customWidth',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 612,
		required: true,
		displayOptions: { show: { operation: ['blankPdf'], pageSize: ['custom'] } },
		description: 'The custom page width as a positive number of PDF units',
		routing: { send: { type: 'body', property: 'custom_width' } },
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: ['blankPdf'] } },
		options: [
			createIncludeFileInfoField('blankPdf'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated blank PDF without an extension',
			}),
			createResponseTypeField('blankPdf'),
		],
	},
];
