import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	addImageDescription,
	addImageOperation,
} from '../../../../nodes/PdfRest/actions/addImage.operation';
import { createDeferredMultipartUploadsPreSend } from '../../../../nodes/PdfRest/helpers/multipart';

const firstImageId = '0950b9bdf-0465-4d3f-8ea3-d2894f1ae839';
const secondImageId = '01240b25a-8936-4437-8652-8410130f1199';

function getField(name: string) {
	return addImageDescription.find((field) => field.name === name);
}

function getOptionalField(name: string) {
	return getField('options')?.options?.find((field) => field.name === name);
}

function context(parameters: Record<string, unknown> = {}): IExecuteSingleFunctions {
	return {
		getNode: () => ({
			name: 'Add Image to PDF',
			type: '@pdfrest/n8n-nodes-pdfrest.pdfRest',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getNodeParameter: (name: string, fallback?: unknown) => parameters[name] ?? fallback,
	} as unknown as IExecuteSingleFunctions;
}

describe('Add Image to PDF operation', () => {
	it('uses the OpenAPI operation identity and batch description', () => {
		expect(addImageOperation).toMatchObject({
			name: 'Add Image to PDF',
			value: 'addImage',
			action: 'Modify · Add Image to PDF',
			description:
				'Insert one or more images into a PDF with custom placement, sizing, reuse, and accessibility tagging',
			routing: {
				request: {
					method: 'POST',
					url: '/pdf-with-added-image',
					headers: { 'Content-Type': 'application/json' },
				},
			},
		});
	});

	it('supports primary PDF file and resource-ID inputs with Input File as the default', () => {
		expect(getField('inputType')).toMatchObject({
			displayName: 'Input Source',
			type: 'options',
			default: 'inputFile',
			options: [
				{ name: 'Input File', value: 'inputFile' },
				{ name: 'Resource ID', value: 'resourceId' },
			],
		});
		expect(getField('inputFileDataFieldName')).toMatchObject({
			displayName: 'Input File Data Field Name',
			type: 'string',
			default: 'data',
			required: true,
			routing: { send: { type: 'body', property: 'file' } },
		});
		expect(getField('resourceId')).toMatchObject({
			displayName: 'Resource ID',
			type: 'string',
			default: '',
			required: true,
			routing: { send: { type: 'body', property: 'id' } },
		});
	});

	it('uses an image source selector with progressive disclosure', () => {
		expect(getField('imageInputType')).toMatchObject({
			displayName: 'Image Input Source',
			type: 'options',
			default: 'inputFile',
			options: [
				{ name: 'Input File', value: 'inputFile' },
				{ name: 'Resource ID', value: 'resourceId' },
			],
		});
		expect(getField('imageFileDataFieldNames')).toMatchObject({
			displayName: 'Image Input File Data Field Name',
			type: 'string',
			typeOptions: {
				multipleValues: true,
				multipleValueButtonText: 'Add Image Input File Data Field Name',
			},
			default: ['data'],
			required: true,
			displayOptions: {
				show: { operation: ['addImage'], imageInputType: ['inputFile'] },
			},
			routing: { send: { type: 'body', property: 'image_files' } },
		});
		expect(getField('imageResourceIdNotice')).toMatchObject({
			displayName:
				'Enter each existing image resource ID in the image_id field of its Image Object',
			type: 'notice',
			displayOptions: {
				show: { operation: ['addImage'], imageInputType: ['resourceId'] },
			},
		});
	});

	it('uses source-specific batch examples for Image Objects', () => {
		const fileImageObjects = getField('imageObjects');
		expect(fileImageObjects).toMatchObject({
			displayName: 'Image Objects',
			type: 'json',
			required: true,
			displayOptions: {
				show: { operation: ['addImage'], imageInputType: ['inputFile'] },
			},
			routing: { send: { type: 'body', property: 'image_objects' } },
		});
		expect(String(fileImageObjects?.default)).toContain('\n');
		expect(JSON.parse(String(fileImageObjects?.default))).toEqual([
			{ image_index: 0, page: '1,3-last', x: 72, y: 144, width: 144 },
		]);
		expect(fileImageObjects?.routing?.send?.preSend).toHaveLength(1);

		const resourceImageObjects = getField('resourceImageObjects');
		expect(resourceImageObjects).toMatchObject({
			displayName: 'Image Objects',
			type: 'json',
			required: true,
			displayOptions: {
				show: { operation: ['addImage'], imageInputType: ['resourceId'] },
			},
			routing: { send: { type: 'body', property: 'image_objects' } },
		});
		expect(String(resourceImageObjects?.default)).toContain('\n');
		expect(JSON.parse(String(resourceImageObjects?.default))).toEqual([
			{
				image_id: '<IMAGE_RESOURCE_ID>',
				page: '1,3-last',
				x: 72,
				y: 144,
				width: 144,
			},
		]);
		expect(resourceImageObjects?.routing?.send?.preSend).toHaveLength(1);
	});

	it('accepts non-canonical pdfRest image IDs and preserves object or array shape', async () => {
		const preSend = getField('resourceImageObjects')?.routing?.send?.preSend?.[0];
		const first = { image_id: firstImageId, page: 1, x: 0, y: 0 };
		const second = {
			image_id: secondImageId,
			page: '2-4,6-last',
			x: 72,
			y: 144,
			height: 36,
		};

		for (const input of [first, [first, second], JSON.stringify([first, second])]) {
			const request: IHttpRequestOptions = {
				url: '/pdf-with-added-image',
				body: { id: 'pdf-id', image_objects: input },
			};
			await preSend?.call(
				context({ imageInputType: 'resourceId', 'options.tagEnabled': false }),
				request,
			);
			expect((request.body as Record<string, unknown>).image_objects).toEqual(
				input === first ? first : [first, second],
			);
			expect(request.body).not.toHaveProperty('image_files');
		}
	});

	it('validates image references, placement values, and supported properties', async () => {
		for (const [parameters, imageObject, message] of [
			[
				{ imageInputType: 'inputFile', imageFileDataFieldNames: ['logo'] },
				{ image_index: 1, page: 1, x: 0, y: 0 },
				'image_index',
			],
			[{ imageInputType: 'resourceId' }, { image_index: 0, page: 1, x: 0, y: 0 }, 'image_id'],
			[
				{ imageInputType: 'resourceId' },
				{ image_id: '   ', page: 1, x: 0, y: 0 },
				'existing image resource ID',
			],
			[{ imageInputType: 'resourceId' }, { image_id: firstImageId, page: '', x: 0, y: 0 }, '.page'],
			[{ imageInputType: 'resourceId' }, { image_id: firstImageId, page: 1, x: -1, y: 0 }, '.x'],
			[
				{ imageInputType: 'resourceId' },
				{ image_id: firstImageId, page: 1, x: 0, y: 0, width: 0 },
				'.width',
			],
			[
				{ imageInputType: 'resourceId' },
				{ image_id: firstImageId, page: 1, x: 0, y: 0, extra: true },
				'unsupported property',
			],
		] as const) {
			const fieldName =
				parameters.imageInputType === 'resourceId' ? 'resourceImageObjects' : 'imageObjects';
			const preSend = getField(fieldName)?.routing?.send?.preSend?.[0];
			await expect(
				preSend?.call(context({ ...parameters, 'options.tagEnabled': false }), {
					url: '/pdf-with-added-image',
					body: { image_objects: [imageObject] },
				}),
			).rejects.toThrow(message);
		}
	});

	it('removes inactive per-image tags and validates active tagging', async () => {
		const preSend = getField('resourceImageObjects')?.routing?.send?.preSend?.[0];
		const inactive: IHttpRequestOptions = {
			url: '/pdf-with-added-image',
			body: {
				image_objects: [
					{
						image_id: firstImageId,
						page: 'all',
						x: 0,
						y: 0,
						tag_alt_text: 'Logo',
						tag_is_artifact: false,
						tag_structure_type: 'Figure',
					},
				],
				tag_enabled: true,
				tag_language: 'en-US',
			},
		};
		await preSend?.call(
			context({ imageInputType: 'resourceId', 'options.tagEnabled': false }),
			inactive,
		);
		expect(inactive.body).toEqual({
			image_objects: [{ image_id: firstImageId, page: 'all', x: 0, y: 0 }],
			tag_enabled: false,
		});

		const active: IHttpRequestOptions = {
			url: '/pdf-with-added-image',
			body: {
				image_objects: [
					{
						image_id: firstImageId,
						page: 'last',
						x: 0,
						y: 0,
						tag_alt_text: 'Company logo',
						tag_is_artifact: false,
						tag_structure_type: 'Figure',
					},
				],
				tag_language: 'en-US',
			},
		};
		await expect(
			preSend?.call(context({ imageInputType: 'resourceId', 'options.tagEnabled': true }), active),
		).resolves.toBe(active);
		expect(active.body).toMatchObject({ tag_enabled: true, tag_language: 'en-US' });
		for (const tag_language of ['zh-Hant-TW', 'i-klingon', 'x-private']) {
			await expect(
				preSend?.call(context({ imageInputType: 'resourceId', 'options.tagEnabled': true }), {
					url: '/pdf-with-added-image',
					body: {
						image_objects: [{ image_id: firstImageId, page: 1, x: 0, y: 0 }],
						tag_language,
					},
				}),
			).resolves.toBeDefined();
		}
		for (const tag_language of ['', 'english_US', 'en--US']) {
			await expect(
				preSend?.call(context({ imageInputType: 'resourceId', 'options.tagEnabled': true }), {
					url: '/pdf-with-added-image',
					body: {
						image_objects: [{ image_id: firstImageId, page: 1, x: 0, y: 0 }],
						tag_language,
					},
				}),
			).rejects.toThrow('Tag Language must be a valid BCP 47 language tag');
		}

		await expect(
			preSend?.call(context({ imageInputType: 'resourceId', 'options.tagEnabled': true }), {
				url: '/pdf-with-added-image',
				body: {
					image_objects: [
						{
							image_id: firstImageId,
							page: 1,
							x: 0,
							y: 0,
							tag_structure_type: 'Table',
						},
					],
				},
			}),
		).rejects.toThrow('tag_structure_type');
	});

	it('uploads a primary PDF and multiple ordered images after preparing Image Objects', async () => {
		const parameters: Record<string, unknown> = {
			inputType: 'inputFile',
			inputFileDataFieldName: 'document',
			imageInputType: 'inputFile',
			imageFileDataFieldNames: ['logo', 'chart'],
			'options.tagEnabled': false,
		};
		const binaryContext = {
			...context(parameters),
			helpers: {
				assertBinaryData: (propertyName: string) => ({
					data: '',
					fileName: propertyName === 'document' ? 'document.pdf' : `${propertyName}.png`,
					mimeType: propertyName === 'document' ? 'application/pdf' : 'image/png',
				}),
				getBinaryDataBuffer: async (propertyName: string) => Buffer.from(propertyName),
			},
		} as unknown as IExecuteSingleFunctions;
		const request: IHttpRequestOptions = {
			url: '/pdf-with-added-image',
			headers: { 'Content-Type': 'application/json' },
			body: {
				file: 'document',
				image_files: ['logo', 'chart'],
				image_objects: [
					{ image_index: 0, page: 1, x: 0, y: 0 },
					{ image_index: 1, page: '2-last', x: 72, y: 144, width: 36 },
				],
			},
		};

		await getField('inputFileDataFieldName')?.routing?.send?.preSend?.[0]?.call(
			binaryContext,
			request,
		);
		await getField('imageObjects')?.routing?.send?.preSend?.[0]?.call(binaryContext, request);
		await createDeferredMultipartUploadsPreSend().call(binaryContext, request);

		const formData = request.body as unknown as FormData;
		expect(request.headers).toEqual({});
		expect((formData.get('file') as File).name).toBe('document.pdf');
		expect(formData.getAll('image_files').map((file) => (file as File).name)).toEqual([
			'logo.png',
			'chart.png',
		]);
		expect(JSON.parse(formData.get('image_objects') as string)).toEqual([
			{ image_index: 0, page: 1, x: 0, y: 0 },
			{ image_index: 1, page: '2-last', x: 72, y: 144, width: 36 },
		]);
	});

	it('declares only batch request fields and alphabetized optional fields', () => {
		expect(getField('options')?.options?.map(({ name }) => name)).toEqual([
			'includeFileInfo',
			'output',
			'responseType',
			'tagEnabled',
			'tagLanguage',
		]);
		expect(getOptionalField('tagLanguage')).toMatchObject({
			displayOptions: { show: { tagEnabled: [true] } },
			routing: { send: { type: 'body', property: 'tag_language' } },
		});

		const definition = JSON.stringify(addImageDescription);
		for (const legacyProperty of [
			'"property":"image_id"',
			'"property":"page"',
			'"property":"x"',
			'"property":"y"',
		]) {
			expect(definition).not.toContain(legacyProperty);
		}
		expect(definition).toContain('"property":"image_objects"');
		expect(definition).toContain('"property":"image_files"');
	});

	it('validates output and inherited headers while omitting Response-Type by default', async () => {
		const output = getOptionalField('output');
		await expect(
			output?.routing?.send?.preSend?.[0]?.call(context(), {
				url: '/pdf-with-added-image',
				body: { output: '' },
			}),
		).rejects.toThrow('Output File Name must contain at least one character.');

		const includeRequest: IHttpRequestOptions = { url: '/pdf-with-added-image' };
		await getOptionalField('includeFileInfo')?.routing?.send?.preSend?.[0]?.call(
			context({ 'options.includeFileInfo': false }),
			includeRequest,
		);
		expect(includeRequest.headers).toEqual({ 'Include-File-Info': false });

		const responseRequest: IHttpRequestOptions = {
			url: '/pdf-with-added-image',
			headers: { Accept: 'application/json', 'Response-Type': 'requestId' },
		};
		await getOptionalField('responseType')?.routing?.send?.preSend?.[0]?.call(
			context({ 'options.responseType': '' }),
			responseRequest,
		);
		expect(responseRequest.headers).toEqual({ Accept: 'application/json' });
	});
});
