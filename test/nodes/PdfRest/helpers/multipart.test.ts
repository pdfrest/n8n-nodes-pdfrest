import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import {
	createMultipartFormData,
	createDeferredMultipartUploadPreSend,
	createDeferredMultipartUploadsPreSend,
	createMultipartUploadPreSend,
} from '../../../../nodes/PdfRest/helpers/multipart';

const setupMultipartUpload = createMultipartUploadPreSend({
	binaryDataPropertyNameParameter: 'inputDataFieldName',
	fileFieldName: 'file',
});

describe('createMultipartUploadPreSend', () => {
	it('serializes structured fields as JSON while preserving repeated primitive fields', () => {
		const formData = createMultipartFormData({
			body: {
				image_ids: ['first-image-id', 'second-image-id'],
				shape_objects: [{ type: 'line', page: 1, x1: 0, y1: 0, x2: 72, y2: 72 }],
				table_objects: {
					page: 1,
					columns: [{ width: 504 }],
					rows: [{ cells: [{ text: 'Name' }] }],
				},
			},
			url: '/pdf-with-added-tables',
		});

		expect(formData.getAll('image_ids')).toEqual(['first-image-id', 'second-image-id']);
		expect(formData.get('shape_objects')).toBe(
			'[{"type":"line","page":1,"x1":0,"y1":0,"x2":72,"y2":72}]',
		);
		expect(formData.get('table_objects')).toBe(
			'{"page":1,"columns":[{"width":504}],"rows":[{"cells":[{"text":"Name"}]}]}',
		);
	});

	it('replaces the request body with the selected binary data as multipart form data', async () => {
		const fileBuffer = Buffer.from('pdf file contents');
		const context = {
			getNodeParameter: () => 'document',
			helpers: {
				assertBinaryData: (propertyName: string) => {
					expect(propertyName).toBe('document');
					return {
						data: '',
						fileName: 'input.pdf',
						mimeType: 'application/pdf',
					};
				},
				getBinaryDataBuffer: async (propertyName: string) => {
					expect(propertyName).toBe('document');
					return fileBuffer;
				},
			},
		} as unknown as IExecuteSingleFunctions;

		const requestOptions = await setupMultipartUpload.call(context, {
			body: { file: 'document', output: 'split', 'pages[]': ['1-2', '3-last'] },
			headers: { 'Content-Type': 'application/json' },
			url: '/upload',
		});

		expect(requestOptions.body).toBeInstanceOf(FormData);
		const file = (requestOptions.body as unknown as FormData).get('file') as File;
		expect(file.name).toBe('input.pdf');
		expect(file.type).toBe('application/pdf');
		expect(Buffer.from(await file.arrayBuffer())).toEqual(fileBuffer);
		expect((requestOptions.body as unknown as FormData).get('output')).toBe('split');
		expect((requestOptions.body as unknown as FormData).getAll('pages[]')).toEqual([
			'1-2',
			'3-last',
		]);
		expect((requestOptions.body as unknown as FormData).getAll('file')).toHaveLength(1);
		expect(requestOptions.headers).not.toHaveProperty('Content-Type');
	});

	it('appends every selected binary field under the repeated multipart field name', async () => {
		const buffers = {
			first: Buffer.from('first file'),
			second: Buffer.from('second file'),
		};
		const context = {
			getNodeParameter: () => ['first', 'second'],
			helpers: {
				assertBinaryData: (propertyName: keyof typeof buffers) => ({
					data: '',
					fileName: `${propertyName}.pdf`,
					mimeType: 'application/pdf',
				}),
				getBinaryDataBuffer: async (propertyName: keyof typeof buffers) => buffers[propertyName],
			},
		} as unknown as IExecuteSingleFunctions;

		const requestOptions = await setupMultipartUpload.call(context, {
			body: { file: ['first', 'second'] },
			url: '/upload',
		});
		const files = (requestOptions.body as unknown as FormData).getAll('file') as File[];

		expect(files.map(({ name }) => name)).toEqual(['first.pdf', 'second.pdf']);
		expect(Buffer.from(await files[0].arrayBuffer())).toEqual(buffers.first);
		expect(Buffer.from(await files[1].arrayBuffer())).toEqual(buffers.second);
	});

	it('rejects missing or malformed input data field name collections', async () => {
		for (const value of [undefined, [], ['data', ''], [123]]) {
			const context = {
				getNode: () => ({ name: 'pdfRest' }),
				getNodeParameter: () => value,
			} as unknown as IExecuteSingleFunctions;

			await expect(
				setupMultipartUpload.call(context, { url: '/upload' } as IHttpRequestOptions),
			).rejects.toThrow('must identify at least one input data field');
		}
	});

	it('rejects input data without a file name', async () => {
		const context = {
			getNode: () => ({ name: 'pdfRest' }),
			getNodeParameter: () => 'document',
			helpers: {
				assertBinaryData: () => ({
					data: '',
					mimeType: 'application/pdf',
				}),
			},
		} as unknown as IExecuteSingleFunctions;

		await expect(
			setupMultipartUpload.call(context, { url: '/upload' } as IHttpRequestOptions),
		).rejects.toThrow('must include a file name');
	});

	it('defers multipart conversion until after request body preparation', async () => {
		const context = {
			getNodeParameter: () => 'document',
			helpers: {
				assertBinaryData: () => ({
					data: '',
					fileName: 'input.pdf',
					mimeType: 'application/pdf',
				}),
				getBinaryDataBuffer: async () => Buffer.from('pdf file contents'),
			},
		} as unknown as IExecuteSingleFunctions;
		const requestOptions: IHttpRequestOptions = {
			body: { file: 'document', redactions: '[{"text":"secret"}]' },
			headers: { 'Content-Type': 'application/json' },
			url: '/pdf-with-redacted-text-preview',
		};

		await createDeferredMultipartUploadPreSend({
			binaryDataPropertyNameParameter: 'inputFileDataFieldName',
			fileFieldName: 'file',
		}).call(context, requestOptions);
		expect(requestOptions.body).toEqual({ file: 'document', redactions: '[{"text":"secret"}]' });

		await createDeferredMultipartUploadsPreSend().call(context, requestOptions);
		const formData = requestOptions.body as unknown as FormData;
		expect(formData).toBeInstanceOf(FormData);
		expect(formData.get('redactions')).toBe('[{"text":"secret"}]');
		expect((formData.get('file') as File).name).toBe('input.pdf');
	});

	it('combines multiple deferred binary fields into one multipart body', async () => {
		const parameters = {
			inputFileDataFieldName: 'document',
			'options.logoFileDataFieldName': 'logo',
			pfxCredentialFileDataFieldName: 'credential',
			pfxPassphraseFileDataFieldName: 'passphrase',
		};
		const context = {
			getNodeParameter: (name: keyof typeof parameters) => parameters[name],
			helpers: {
				assertBinaryData: (propertyName: string) => ({
					data: '',
					fileName: `${propertyName}.bin`,
					mimeType: 'application/octet-stream',
				}),
				getBinaryDataBuffer: async (propertyName: string) => Buffer.from(propertyName),
			},
		} as unknown as IExecuteSingleFunctions;
		const requestOptions: IHttpRequestOptions = {
			body: {
				file: 'document',
				logo_file: 'logo',
				pfx_credential_file: 'credential',
				pfx_passphrase_file: 'passphrase',
				signature_configuration: '{"type":"new","name":"esignature"}',
			},
			url: '/signed-pdf',
		};

		for (const upload of [
			{
				binaryDataPropertyNameParameter: 'inputFileDataFieldName',
				fileFieldName: 'file',
			},
			{
				binaryDataPropertyNameParameter: 'pfxCredentialFileDataFieldName',
				fileFieldName: 'pfx_credential_file',
			},
			{
				binaryDataPropertyNameParameter: 'pfxPassphraseFileDataFieldName',
				fileFieldName: 'pfx_passphrase_file',
			},
			{
				binaryDataPropertyNameParameter: 'options.logoFileDataFieldName',
				fileFieldName: 'logo_file',
			},
		]) {
			await createDeferredMultipartUploadPreSend(upload).call(context, requestOptions);
		}

		await createDeferredMultipartUploadsPreSend().call(context, requestOptions);
		const formData = requestOptions.body as unknown as FormData;

		expect((formData.get('file') as File).name).toBe('document.bin');
		expect((formData.get('pfx_credential_file') as File).name).toBe('credential.bin');
		expect((formData.get('pfx_passphrase_file') as File).name).toBe('passphrase.bin');
		expect((formData.get('logo_file') as File).name).toBe('logo.bin');
		expect(formData.get('signature_configuration')).toBe('{"type":"new","name":"esignature"}');
	});
});
