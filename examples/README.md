# Example Workflows for pdfRest

These ready-to-import n8n workflows show how to use `pdfRest` with forms,
email, Google Drive, Google Sheets, and AI Agent nodes. Each workflow includes
an on-canvas setup note with the values that must be configured before use.

## How to Import

1. Install `@pdfrest/n8n-nodes-pdfrest` and configure a pdfRest credential in n8n.
2. Open **Workflows** in n8n and select **Import from File**.
3. Choose one of the JSON files in this directory.
4. Open every node displaying a credential warning and select your credential.
5. Replace every value beginning with `YOUR_`, such as folder IDs, spreadsheet
   IDs, or pdfRest resource IDs.
6. Review the workflow's **Setup** note, test it with non-sensitive sample
   files, and publish it only after the test succeeds.

The credential IDs in these files are placeholders. Credentials and secrets
must remain in n8n credentials or secure inputs; do not put API keys, signing
passphrases, or document passwords directly in workflow JSON.

OCR PDF, Sign PDF, and Summarize PDF require a pdfRest Pro plan. API operations
consume quota, so test with a small number of files before enabling a polling
trigger.

## Available Examples

| # | Workflow | File |
| --- | --- | --- |
| 1 | Turn scanned documents into searchable PDF/A records | [`01-scanned-documents-to-searchable-pdfa.json`](01-scanned-documents-to-searchable-pdfa.json) |
| 2 | Generate signed invoices from data | [`02-generate-signed-invoices.json`](02-generate-signed-invoices.json) |
| 3 | Prepare PDFs for AI: OCR, Markdown, summary, then agent | [`03-prepare-pdfs-for-ai.json`](03-prepare-pdfs-for-ai.json) |
| 4 | Make emailed PDF attachments searchable and save to Google Drive | [`04-gmail-attachments-to-searchable-pdfs.json`](04-gmail-attachments-to-searchable-pdfs.json) |
| 5 | Convert Word, Excel, PowerPoint, and images to PDF on upload | [`05-convert-uploaded-files-to-pdf.json`](05-convert-uploaded-files-to-pdf.json) |
| 6 | Compress PDF files on demand via form upload | [`06-compress-pdf-from-form.json`](06-compress-pdf-from-form.json) |
| 7 | Chat with any PDF: convert to Markdown and hand to an AI Agent | [`07-pdf-to-markdown-ai-agent.json`](07-pdf-to-markdown-ai-agent.json) |
| 8 | Combine all PDFs in a folder into a single file | [`08-merge-folder-pdfs.json`](08-merge-folder-pdfs.json) |

## 1. Turn Scanned Documents into Searchable PDF/A Records

**Workflow:**

```text
Google Drive Trigger -> Download -> [optional Convert to PDF] -> OCR
  -> Query PDF Metadata -----------\
  -> Convert to PDF/A-2b -----------> Join -> Upload -> [optional Log]
```

Use this workflow to turn incoming scans into searchable PDF/A-2b records in an
Archive folder. OCR defaults to English. The metadata query retrieves the page
count and title, and the optional Google Sheets node records the source
filename, page count, archive URL, and timestamp.

Before running it:

- Replace `YOUR_INBOX_FOLDER_ID` and `YOUR_ARCHIVE_FOLDER_ID`.
- Select Google Drive and pdfRest credentials.
- Enable **Convert Image to PDF** only for image inputs. It is disabled by
  default so already-PDF inputs go directly to OCR.
- Change the OCR languages when the scans are not English.
- Enable **Log Archive Record** only after configuring its Google Sheets
  credential, spreadsheet, sheet, and destination columns.
- Choose PDF/A-3b instead of PDF/A-2b when embedded attachments must be
  retained. Turn rasterization on only when ordinary conversion fails.

**Expected output:** A searchable PDF/A-2b file in the Archive folder and, when
enabled, one log row for the document.

**Implementation additions:** The metadata operation returns JSON while the
archival operation needs the OCR file. The workflow therefore branches after
OCR and uses **Join File and Metadata** as a completion barrier before upload.
Each file-producing pdfRest node also downloads its output into the `data`
field so the next node can use it.

## 2. Generate Signed Invoices from Data

**Workflow:**

```text
Multipart Webhook -> Shape Invoice Data -> Create Blank PDF -> Add Text
  -> Restore Logo -> [optional Add Logo] -> Restore Terms
  -> [optional Merge Terms] -> Restore Signing Files -> Sign -> Send Email
```

POST invoice fields and signing files as `multipart/form-data` to create a
one-page Letter invoice, sign it, and send it through SMTP. The on-canvas note
lists the complete payload. Change **Page Size** to A4 for an EU-oriented
invoice.

```bash
curl -X POST 'YOUR_WEBHOOK_URL' \
  -F 'invoiceNumber=INV-1001' \
  -F 'customer=Ada Lovelace' \
  -F 'customerEmail=ada@example.com' \
  -F 'accountNumber=ACCT-1001' \
  -F 'currency=USD' \
  -F 'lineItems=[{"description":"Consulting","quantity":2,"unitPrice":125}]' \
  -F 'total=250' \
  -F 'pfx=@./certificate.pfx' \
  -F 'pfxPassphrase=@./passphrase.txt'
```

Add `-F 'logo=@./logo.png'` or `-F 'terms=@./terms.pdf'` when enabling the
corresponding optional node.

Before running it:

- Select pdfRest and SMTP credentials and change the sender address.
- Include the PFX certificate in the `pfx` file field and its passphrase text
  file in `pfxPassphrase`.
- Include `logo` and enable **Add Logo** when branded invoices are required.
- Include `terms` and enable **Append Standard Terms** when the invoice should
  include a terms PDF.

**Expected output:** One signed invoice PDF per webhook call, attached to an
email for the customer.

**Implementation additions:** The optional logo and terms steps are present but
disabled so the base workflow does not require those files. Three Merge nodes
restore the original webhook files immediately before the nodes that consume
them, because pdfRest responses replace the current binary item. Output
downloading is enabled between every PDF operation so the generated file
continues through the chain. Terms are appended before signing so the signature
covers the complete invoice.

## 3. Prepare PDFs for AI: OCR, Markdown, Summary, Then Agent

**Workflow:**

```text
n8n Form -> Query Page Count -------------------------------\
         -> OCR -> PDF to Markdown ----\                     \
                -> Summarize PDF -------> Join Content -------> Join Metadata
                                                            -> AI Agent
OpenAI Chat Model -------------------------------------------> AI Agent
```

The form accepts a PDF and a question. The workflow queries its page count,
creates an OCR version, converts that version to Markdown with page-break
comments, and produces a 200-word bullet-point Markdown summary. The Agent uses
the full Markdown as context and the summary as orientation.

Before running it:

- Select pdfRest and OpenAI credentials.
- Change OCR languages when necessary.
- For a born-digital PDF, disable OCR or extend the metadata query with **Image
  Only** and add an If node that sends only image-only documents through OCR.
- Restrict **Pages** on the Markdown and Summarize operations for very large
  documents.
- Replace the Agent with vector-store insertion nodes to use the workflow as a
  RAG ingestion pipeline.

**Expected output:** Markdown text, a bullet summary, document metadata, and an
Agent response to the submitted question.

**Implementation additions:** Metadata, Markdown, and summary operations return
separate JSON items, so two Merge nodes act as completion barriers. An OpenAI
Chat Model node was added because an AI Agent cannot run without a connected
language model. The form includes a question field so the Agent has a user
prompt as well as document context.

## 4. Make Emailed PDF Attachments Searchable and Save to Google Drive

**Workflow:**

```text
Gmail Trigger -> OCR Email Attachment -> Save Searchable PDF
```

The Gmail Trigger polls for unread messages matching
`has:attachment filename:pdf`, downloads their attachments, OCRs
`attachment_0`, and saves the result to Google Drive using the email subject as
the filename.

Before running it:

- Select Gmail, pdfRest, and Google Drive credentials.
- Replace `YOUR_SEARCHABLE_FOLDER_ID`.
- Adjust the Gmail search query or OCR languages as needed.

**Expected output:** An OCR-processed PDF in the Searchable folder shortly
after the email arrives.

**Implementation addition:** Gmail can expose multiple binary attachment
fields, but one pdfRest operation consumes one named primary file. This example
intentionally handles the first attachment. Add a Code or Split Out node to
emit one item per attachment when every attachment must be processed.

## 5. Convert Word, Excel, PowerPoint, and Images to PDF on Upload

**Workflow:**

```text
Google Drive Trigger -> Download Uploaded File -> Convert File to PDF
  -> Upload Converted PDF
```

Files added to a Convert folder are downloaded, converted, and saved in a PDF
folder with their original base filename.

Supported inputs include Word, Excel, PowerPoint, CSV, HTML, JSON, Markdown,
plain text, PostScript/EPS, XML, email, and BMP/JPG/PNG/TIFF images. Already-PDF
files do not need this workflow.

Before running it:

- Select Google Drive and pdfRest credentials.
- Replace `YOUR_CONVERT_FOLDER_ID` and `YOUR_PDF_FOLDER_ID`.
- To produce accessibility tags for a supported Office or structured-text
  format, select the matching **Input Format** and enable **Tagged PDF**.

**Expected output:** One PDF in the destination folder for each supported file
added to the source folder.

**Implementation detail:** **Input Format** remains **Not Specified** so one
template can auto-detect different uploaded file types. Format-specific options
such as **Tagged PDF** only become active after an explicit format is selected.

## 6. Compress PDF Files on Demand via Form Upload

**Workflow:**

```text
n8n Form -> Compress PDF -> Return Compressed PDF
```

The form accepts one PDF and a Low, Medium, or High compression level. pdfRest
compresses the file, and the form returns the resulting binary as a download.

Before running it, select a pdfRest credential and test the Form URL with a
non-sensitive PDF.

**Expected output:** A smaller PDF returned to the person who submitted the
form.

**Implementation addition:** An n8n Form Ending node was added after pdfRest.
It uses **Return Binary File** with the `data` field, which supplies the direct
download experience described by the plan.

## 7. Chat with Any PDF: Convert to Markdown and Hand to an AI Agent

**Workflow:**

```text
n8n Form -> PDF to Markdown -> AI Agent
OpenAI Chat Model -----------> AI Agent
```

The form collects a PDF and a question. pdfRest returns the PDF content as
Markdown JSON, and the Agent answers using that content.

Before running it, select pdfRest and OpenAI credentials. To make this a
multi-turn chat, replace the Form Trigger with a Chat Trigger that supports file
uploads in your n8n deployment while preserving the `data` file field.

**Expected output:** An Agent response grounded in the uploaded PDF.

**Implementation additions:** The portable example uses a Form Trigger because
it provides a defined file-upload field and works as a one-shot question flow.
The required OpenAI Chat Model is included, so the runnable workflow contains
more than the two visible processing steps in the original outline.

## 8. Combine All PDFs in a Folder into a Single File

**Workflow:**

```text
Manual Trigger -> List PDFs -> Download Each PDF -> Sort and Collect Files
  -> Merge PDFs -> Upload Merged PDF
```

The workflow finds PDF files in a Google Drive folder, orders them by filename,
merges every page, and writes a timestamped PDF to an output folder. Prefix
filenames with `01-`, `02-`, and so on to control page order.

Before running it:

- Select Google Drive and pdfRest credentials.
- Replace `YOUR_MERGE_FOLDER_ID` in the **Folder** filter and
  `YOUR_MERGED_OUTPUT_FOLDER_ID` on the upload node.
- Put at least two PDFs in the Merge folder.
- If the folder contains more than two PDFs, add one **Merge Inputs** entry on
  **Merge PDFs** for each additional file.
- Replace the Manual Trigger with a Schedule Trigger if the workflow should run
  automatically.

**Expected output:** One merged PDF in filename order.

**Implementation addition:** Google Drive returns one item per downloaded file,
but Merge PDFs makes one request from one item containing several named binary
fields. **Sort and Collect PDF Files** consolidates the items into `data`,
`data_1`, and subsequent fields. **Merge Inputs** contains entries for `data`
and `data_1` by default. Add `data_2`, `data_3`, and subsequent entries when the
folder contains more files.

## Troubleshooting

### A node asks for a credential after import

Placeholder credential references are intentional. Open the node and select a
credential owned by your n8n project.

### pdfRest cannot find the input file

Confirm that the upstream binary field matches **Input File Data Field Name**.
The form examples use `data`; the Gmail example uses `attachment_0`.

### A Google Drive node cannot find a folder

Replace the corresponding `YOUR_*_FOLDER_ID` placeholder with the folder ID,
not the complete Google Drive URL, and make sure the selected credential can
access that folder.

### Signing fails

Include the PFX certificate in the `pfx` file field and its passphrase text file
in `pfxPassphrase`. The signature configuration must match that certificate.

### The AI Agent does not run

Select credentials on both the pdfRest nodes and the OpenAI Chat Model. AI
Agent nodes require a connected language model even when the prompt is already
defined.
