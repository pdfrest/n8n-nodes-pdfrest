import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField } from '../helpers/headers';

export const deleteResourceOperation: INodePropertyOptions = {
	name: 'Delete Resource by ID',
	value: 'deleteResource',
	action: 'Files · Delete File by ID',
	description: 'Delete one previously uploaded or generated pdfRest resource by its ID',
	routing: {
		request: {
			method: 'DELETE',
			url: '=/resource/{{$parameter.resourceId}}',
		},
	},
};

export const deleteResourceDescription: INodeProperties[] = [
	{
		displayName: 'Resource ID',
		name: 'resourceId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['deleteResource'],
			},
		},
		description: 'The ID of the pdfRest resource to delete',
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['deleteResource'],
			},
		},
		options: [createIncludeFileInfoField('deleteResource')],
	},
];
