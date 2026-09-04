import {
	NodeOperationError,
	type IDataObject,
	type IHttpRequestOptions,
	type INodeProperties,
	type INodePropertyOptions,
	type PreSendAction,
} from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from './headers';
import { createResourceIdField } from './resourceId';

interface RasterConversionDescriptionOptions {
	operation: string;
	colorModels: INodePropertyOptions[];
	includeJpegQuality?: boolean;
}

function createBodyStringValidator(
	bodyProperty: string,
	displayName: string,
	pattern?: RegExp,
): PreSendAction {
	return async function validateBodyString(
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const body = requestOptions.body;
		const value =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as IDataObject)[bodyProperty]
				: undefined;

		if (value === undefined) {
			return requestOptions;
		}

		if (typeof value !== 'string' || value.length < 1 || (pattern && !pattern.test(value))) {
			throw new NodeOperationError(this.getNode(), `${displayName} has an invalid value.`);
		}

		return requestOptions;
	};
}

export function createRasterConversionDescription({
	operation,
	colorModels,
	includeJpegQuality = false,
}: RasterConversionDescriptionOptions): INodeProperties[] {
	const options: INodeProperties[] = [
		{
			displayName: 'Color Model',
			name: 'colorModel',
			type: 'options',
			options: colorModels,
			default: 'rgb',
			description: 'The color model to use for generated images',
			routing: {
				send: {
					type: 'body',
					property: 'color_model',
				},
			},
		},
		createIncludeFileInfoField(operation),
	];

	if (includeJpegQuality) {
		options.push({
			displayName: 'JPEG Quality',
			name: 'jpegQuality',
			type: 'number',
			typeOptions: {
				minValue: 1,
				maxValue: 100,
				numberPrecision: 0,
			},
			default: 75,
			description: 'The JPEG quality from 1 to 100',
			routing: {
				send: {
					type: 'body',
					property: 'jpeg_quality',
				},
			},
		});
	}

	options.push(
		{
			displayName: 'Output File Name',
			name: 'output',
			type: 'string',
			default: '',
			description: 'The prefix for generated image file names without a file extension',
			routing: {
				send: {
					type: 'body',
					property: 'output',
					preSend: [createBodyStringValidator('output', 'Output File Name')],
				},
			},
		},
		{
			displayName: 'Pages',
			name: 'pages',
			type: 'string',
			default: '1-last',
			placeholder: 'e.g. 1,2,5-10,12-last',
			description: 'The pages to convert, using page numbers, ranges, and last',
			routing: {
				send: {
					type: 'body',
					property: 'pages',
				},
			},
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'The password for opening an encrypted PDF',
			routing: {
				send: {
					type: 'body',
					property: 'password',
					preSend: [createBodyStringValidator('password', 'Password')],
				},
			},
		},
		{
			displayName: 'Resolution',
			name: 'resolution',
			type: 'number',
			typeOptions: {
				minValue: 12,
				maxValue: 2400,
				numberPrecision: 0,
			},
			default: 300,
			description: 'The output resolution in dots per inch',
			routing: {
				send: {
					type: 'body',
					property: 'resolution',
				},
			},
		},
		createResponseTypeField(operation),
		{
			displayName: 'Smoothing',
			name: 'smoothing',
			type: 'string',
			default: 'none',
			placeholder: 'e.g. text,line,image',
			description:
				'Use none, all, or a comma-separated combination of text, line, and image',
			routing: {
				send: {
					type: 'body',
					property: 'smoothing',
					preSend: [
						createBodyStringValidator(
							'smoothing',
							'Smoothing',
							/^(?:none|all|(?:text|line|image)(?:,(?:text|line|image))*)$/,
						),
					],
				},
			},
		},
	);

	return [
		createResourceIdField(operation),
		{
			displayName: 'Optional Fields',
			name: 'options',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			displayOptions: {
				show: {
					operation: [operation],
				},
			},
			options,
		},
	];
}
