import type { INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { addImageDescription } from '../../../../nodes/PdfRest/actions/addImage.operation';
import { addShapesDescription } from '../../../../nodes/PdfRest/actions/addShapes.operation';
import { addTablesDescription } from '../../../../nodes/PdfRest/actions/addTables.operation';
import { addTextDescription } from '../../../../nodes/PdfRest/actions/addText.operation';
import { redactionPreviewDescription } from '../../../../nodes/PdfRest/actions/redactionPreview.operation';
import { setPageBoxesDescription } from '../../../../nodes/PdfRest/actions/setPageBoxes.operation';
import { signDescription } from '../../../../nodes/PdfRest/actions/sign.operation';

interface NoticeCase {
	description: INodeProperties[];
	jsonFieldNames: string[];
	label: string;
	noticeName: string;
	operation: string;
	url: string;
}

const noticeCases: NoticeCase[] = [
	{
		description: signDescription,
		jsonFieldNames: ['signatureConfiguration'],
		label: 'Signature Configuration',
		noticeName: 'signatureConfigurationNotice',
		operation: 'sign',
		url: 'https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/sign-pdf/POST/signed-pdf.body.signature_configuration/',
	},
	{
		description: addImageDescription,
		jsonFieldNames: ['imageObjects', 'resourceImageObjects'],
		label: 'Image Objects',
		noticeName: 'imageObjectsNotice',
		operation: 'addImage',
		url: 'https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/add-to-pdf/POST/pdf-with-added-image/',
	},
	{
		description: addTextDescription,
		jsonFieldNames: ['textObjects'],
		label: 'Text Objects',
		noticeName: 'textObjectsNotice',
		operation: 'addText',
		url: 'https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/add-to-pdf/POST/pdf-with-added-text.body.text_objects/',
	},
	{
		description: addShapesDescription,
		jsonFieldNames: ['shapeObjects'],
		label: 'Shape Objects',
		noticeName: 'shapeObjectsNotice',
		operation: 'addShapes',
		url: 'https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/add-to-pdf/POST/pdf-with-added-shapes.body.shape_objects/',
	},
	{
		description: addTablesDescription,
		jsonFieldNames: ['tableObjects'],
		label: 'Table Objects',
		noticeName: 'tableObjectsNotice',
		operation: 'addTables',
		url: 'https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/add-to-pdf/POST/pdf-with-added-tables.body.table_objects/',
	},
	{
		description: redactionPreviewDescription,
		jsonFieldNames: ['redactions'],
		label: 'Redactions',
		noticeName: 'redactionsNotice',
		operation: 'redactionPreview',
		url: 'https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/redact-pdf/POST/pdf-with-redacted-text-preview.body.redactions/',
	},
	{
		description: setPageBoxesDescription,
		jsonFieldNames: ['pageBoxDefinitions'],
		label: 'Page Box Definitions',
		noticeName: 'pageBoxDefinitionsNotice',
		operation: 'setPageBoxes',
		url: 'https://docs.pdfrest.com/pdfrest-api-toolkit-cloud/api-reference-guide/tool/set-page-boxes/POST/pdf-with-page-boxes-set.body.boxes/',
	},
];

describe('JSON documentation notices', () => {
	it.each(noticeCases)(
		'couples $label documentation to its JSON field',
		({ description, jsonFieldNames, label, noticeName, operation, url }) => {
			const jsonFieldIndexes = jsonFieldNames.map((jsonFieldName) =>
				description.findIndex((field) => field.name === jsonFieldName),
			);
			for (const jsonFieldIndex of jsonFieldIndexes) {
				expect(jsonFieldIndex).toBeGreaterThanOrEqual(0);
				expect(description[jsonFieldIndex]).toMatchObject({ type: 'json' });
			}

			const notice = description[Math.max(...jsonFieldIndexes) + 1];
			expect(notice).toMatchObject({
				displayName: `${label} documentation: <a href="${url}" target="_blank">Learn how to build the object</a>`,
				name: noticeName,
				type: 'notice',
				default: '',
				displayOptions: { show: { operation: [operation] } },
			});

			const optionalFieldNames = description.flatMap((field) =>
				field.type === 'collection' ? (field.options ?? []).map((option) => option.name) : [],
			);
			expect(optionalFieldNames).not.toContain(noticeName);
		},
	);
});
