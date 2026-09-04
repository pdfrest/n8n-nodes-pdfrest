import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createNonEmptyBodyStringField } from '../helpers/bodyFields';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createResourceIdField, createResourceIdOperation } from '../helpers/resourceId';

export const unzipOperation: INodePropertyOptions = createResourceIdOperation({
	name: 'Extract Files from ZIP Archive',
	value: 'unzip',
	action: 'Files · Unzip Archive',
	description: 'Extract files from a ZIP archive, including password-protected archives',
	path: '/unzip',
});

export const unzipDescription: INodeProperties[] = [
	createResourceIdField('unzip'),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { operation: ['unzip'] } },
		options: [
			createIncludeFileInfoField('unzip'),
			createNonEmptyBodyStringField({
				displayName: 'Output File Name',
				name: 'output',
				bodyProperty: 'output',
				description: 'The name of the generated output without an extension',
			}),
			createNonEmptyBodyStringField({
				displayName: 'Password',
				name: 'password',
				bodyProperty: 'password',
				description: 'The password used to unlock a protected ZIP archive',
				password: true,
			}),
			createResponseTypeField('unzip'),
		],
	},
];
