import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';
import { createInputSourceFields } from '../helpers/inputSource';

export const uploadOperation: INodePropertyOptions = {
	name: 'Upload Files or URLs',
	value: 'upload',
	action: 'Files · Upload Files or URLs',
	description: 'Upload files to pdfRest from n8n file data or publicly accessible URLs',
	routing: {
		request: {
			method: 'POST',
			url: '/upload',
		},
	},
};

export const uploadDescription: INodeProperties[] = [
	...createInputSourceFields({
		operation: 'upload',
		sources: ['file', 'url'],
		file: {
			multipleValues: true,
			description: 'The names of the input fields containing the files to upload',
		},
		url: {
			displayName: 'File URLs',
			multipleValues: true,
			requestFormat: 'multipart',
		},
	}),
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['upload'],
			},
		},
		options: [createIncludeFileInfoField('upload'), createResponseTypeField('upload')],
	},
];
