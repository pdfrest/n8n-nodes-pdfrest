# Integration Test Fixtures

These files support the live pdfRest integration workflows and preserve the
existing local test assets unchanged.

The signing fixture deliberately omits `02-credential.pfx` and
`03-password.txt`. Generate those files for each test run with:

```bash
scripts/generate-test-signing-certificate.sh <output-directory>
```

Keep the generated certificate, private key, and password outside the
repository and delete the output directory after the test run.
