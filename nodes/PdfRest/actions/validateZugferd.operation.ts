import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField } from '../helpers/headers';
import { createInputSourceFields } from '../helpers/inputSource';
import { createResourceIdOperation } from '../helpers/resourceId';

export const validateZugferdOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Validate ZUGFeRD PDF',
	value: 'validateZugferd',
	action: 'Analyze · Validate ZUGFeRD PDF',
	description: 'Check a ZUGFeRD or Factur-X invoice PDF and return validation findings',
	path: '/validated-zugferd',
});

export const validateZugferdDescription: INodeProperties[] = [
	...createInputSourceFields({
		operation: 'validateZugferd',
		description: 'Choose the completed ZUGFeRD PDF file or its pdfRest resource ID to validate',
		resourceIdDescription: 'The resource ID of the completed ZUGFeRD PDF to validate',
		file: {
			deferUpload: true,
			description: 'The input field containing the completed ZUGFeRD PDF to validate',
		},
	}),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: ['validateZugferd'] } },
		options: [createIncludeFileInfoField('validateZugferd')],
	},
];
