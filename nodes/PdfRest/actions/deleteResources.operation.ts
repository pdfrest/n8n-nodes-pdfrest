import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { createIncludeFileInfoField, createResponseTypeField } from '../helpers/headers';

export const deleteResourcesOperation: INodePropertyOptions = {
	name: 'Delete One or More Resource Files by ID',
	value: 'deleteResources',
	action: 'Files · Delete Files by ID',
	description: 'Delete multiple previously uploaded or generated pdfRest resources in one request',
	routing: {
		request: {
			method: 'POST',
			url: '/delete',
			headers: {
				'Content-Type': 'application/json',
			},
		},
	},
};

export const deleteResourcesDescription: INodeProperties[] = [
	{
		displayName: 'Resource IDs',
		name: 'resourceIds',
		type: 'string',
		default:
			'0950b9bd-f046-4d3f-8ea3-d2894f1ae839, 12f7ea0d-0e56-44bc-a3d2-42fdff96d993',
		required: true,
		displayOptions: {
			show: {
				operation: ['deleteResources'],
			},
		},
		description: 'A comma-separated list of pdfRest resource IDs to delete',
		routing: {
			send: {
				type: 'body',
				property: 'ids',
			},
		},
	},
	{
		displayName: 'Optional Fields',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['deleteResources'],
			},
		},
		options: [
			createIncludeFileInfoField('deleteResources'),
			createResponseTypeField('deleteResources'),
		],
	},
];
