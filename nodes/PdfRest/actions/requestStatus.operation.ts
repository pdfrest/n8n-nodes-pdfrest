import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField } from '../helpers/headers';

export const requestStatusOperation: INodePropertyOptions = {
	name: 'Poll for an Async Request Result',
	value: 'getRequestStatus',
	action: 'Files · Poll for Request Status',
	description: 'Check the status and result of an asynchronous pdfRest request using its request ID',
	routing: {
		request: {
			method: 'GET',
			url: '=/request-status/{{$parameter.requestId}}',
		},
	},
};

export const requestStatusDescription: INodeProperties[] = [
	{
		displayName: 'Request ID',
		name: 'requestId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['getRequestStatus'],
			},
		},
		description: 'The ID returned by an asynchronous pdfRest request',
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['getRequestStatus'],
			},
		},
		options: [createIncludeFileInfoField('getRequestStatus')],
	},
];
