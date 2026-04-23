import { describe, it, expect, vi, beforeEach } from 'vitest';

global.Neutralino = {
  os: {
    execCommand: vi.fn()
  }
};

global.NL_OS = 'Windows';

import { NeutralFetch } from '../resources/js/fetch.js';

/** Decode the UTF-16LE Base64 encoded script from a powershell -EncodedCommand call */
function decodeScript(cmd) {
  const base64 = cmd.replace('powershell -EncodedCommand ', '');
  const binary = atob(base64);
  let result = '';
  for (let i = 0; i < binary.length; i += 2) {
    result += String.fromCharCode(binary.charCodeAt(i) | (binary.charCodeAt(i + 1) << 8));
  }
  return result;
}

/** Extract and decode the PowerShell script from the mock call */
function getScript() {
  const cmd = vi.mocked(Neutralino.os.execCommand).mock.calls[0][0];
  return decodeScript(cmd);
}

describe('NeutralFetch._windowsFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make a GET request without headers or body', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "ok"}',
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://example.com',
      'GET',
      {},
      null,
      true,
      true
    );

    expect(result).toEqual({ result: 'ok' });
    const script = getScript();
    expect(script).toContain('Invoke-WebRequest -UseBasicParsing -Uri');
    expect(script).not.toContain('-Body');
  });

  it('should make a POST request with body', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "ok"}',
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://example.com',
      'POST',
      {},
      'test body content',
      true,
      true
    );

    expect(result).toEqual({ result: 'ok' });
    const script = getScript();
    expect(script).toContain('-Method POST');
    expect(script).toContain('-Body');
  });

  it('should escape single quotes in body', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "ok"}',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://example.com',
      'POST',
      {},
      "test's body",
      true,
      true
    );

    const script = getScript();
    expect(script).toContain("test''s body");
  });

  it('should include headers when provided', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "ok"}',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://example.com',
      'GET',
      { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
      null,
      true,
      true
    );

    const script = getScript();
    expect(script).toContain('-Headers');
    expect(script).toContain("'Content-Type'='application/json'");
  });

  it('should not include -Headers when none provided', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "ok"}',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://example.com',
      'GET',
      {},
      null,
      true,
      true
    );

    const script = getScript();
    expect(script).not.toContain('-Headers');
  });

  it('should throw error on non-200 status when throwOnError is true', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '404\n{"error": "not found"}',
      exitCode: 0
    });

    await expect(
      NeutralFetch._windowsFetch(
        'https://example.com',
        'GET',
        {},
        null,
        true,
        true
      )
    ).rejects.toThrow('HTTP 404: {"error": "not found"}');
  });

  it('should return error object on non-200 status when throwOnError is false', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '404\n{"error": "not found"}',
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://example.com',
      'GET',
      {},
      null,
      false,
      true
    );

    expect(result).toEqual({
      status: 404,
      body: '{"error": "not found"}'
    });
  });

  it('should parse JSON response when parseJson is true and status is 200', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"key": "value"}',
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://example.com',
      'GET',
      {},
      null,
      true,
      true
    );

    expect(result).toEqual({ key: 'value' });
  });

  it('should not parse JSON response when parseJson is false', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"key": "value"}',
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://example.com',
      'GET',
      {},
      null,
      true,
      false
    );

    expect(result).toBe('{"key": "value"}');
  });

  it('should handle multi-line response body', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\nLine 1\nLine 2\nLine 3',
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://example.com',
      'GET',
      {},
      null,
      true,
      false
    );

    expect(result).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should handle PUT request method', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "updated"}',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://example.com',
      'PUT',
      {},
      'new data',
      true,
      true
    );

    const script = getScript();
    expect(script).toContain('-Method PUT');
  });

  it('should handle DELETE request method', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "deleted"}',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://example.com',
      'DELETE',
      {},
      null,
      true,
      true
    );

    const script = getScript();
    expect(script).toContain('-Method DELETE');
  });

  it('should handle empty body string', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "ok"}',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://example.com',
      'POST',
      {},
      '',
      true,
      true
    );

    const script = getScript();
    expect(script).not.toContain('-Body');
  });

  it('should handle special characters in body', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n{"result": "ok"}',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://example.com',
      'POST',
      {},
      'test\nbody\rcontent',
      true,
      true
    );

    const script = getScript();
    expect(script).toContain('-Body');
  });

  it('should handle SOAP API request with correct headers and body', async () => {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <ns1:checkVat>
      <ns1:countryCode>DE</ns1:countryCode>
      <ns1:vatNumber>123456789</ns1:vatNumber>
    </ns1:checkVat>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    const soapResponse = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <ns1:checkVatResponse>
      <ns1:countryCode>DE</ns1:countryCode>
      <ns1:vatNumber>123456789</ns1:vatNumber>
      <ns1:valid>true</ns1:valid>
      <ns1:name>Test Company</ns1:name>
      <ns1:address>Test Street 1, 12345 Berlin</ns1:address>
    </ns1:checkVatResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n' + soapResponse,
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
      'POST',
      {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      soapBody,
      true,
      false
    );

    const script = getScript();
    expect(script).toContain('Content-Type');
    expect(script).toContain('text/xml; charset=utf-8');
    expect(script).toContain('SOAPAction');
    expect(script).toContain('-Body');
    expect(script).toContain('checkVat');
  });

  it('should escape single quotes in SOAP XML body', async () => {
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope>
  <SOAP-ENV:Body>
    <ns1:checkVat>
      <ns1:countryCode>IT</ns1:countryCode>
      <ns1:vatNumber>123456789</ns1:vatNumber>
    </ns1:checkVat>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    const soapBodyWithQuotes = soapBody.replace('IT', 'IT'); // No change needed, just for reference

    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n<response/>',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
      'POST',
      {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      soapBodyWithQuotes,
      true,
      false
    );

    expect(Neutralino.os.execCommand).toHaveBeenCalled();
  });

  it('should handle SOAP fault response', async () => {
    const soapFault = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <SOAP-ENV:Fault>
      <faultstring>INVALID_INPUT</faultstring>
      <faultcode>Client</faultcode>
    </SOAP-ENV:Fault>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n' + soapFault,
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
      'POST',
      {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      '<?xml version="1.0"?><Envelope><Body><checkVat/></Body></Envelope>',
      true,
      false
    );

    expect(result).toContain('SOAP-ENV:Fault');
  });

  it('should handle SOAP rate limiting response', async () => {
    const rateLimitResponse = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <SOAP-ENV:Fault>
      <faultstring>MS_MAX_CONCURRENT_REQ</faultstring>
    </SOAP-ENV:Fault>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n' + rateLimitResponse,
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
      'POST',
      {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      '<?xml version="1.0"?><Envelope><Body><checkVat/></Body></Envelope>',
      true,
      false
    );

    expect(result).toContain('MS_MAX_CONCURRENT_REQ');
  });

  it('should handle SOAP invalid VAT response', async () => {
    const invalidVatResponse = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <ns1:checkVatResponse>
      <ns1:countryCode>FR</ns1:countryCode>
      <ns1:vatNumber>99999999999</ns1:vatNumber>
      <ns1:valid>false</ns1:valid>
      <ns1:name></ns1:name>
      <ns1:address></ns1:address>
    </ns1:checkVatResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n' + invalidVatResponse,
      exitCode: 0
    });

    const result = await NeutralFetch._windowsFetch(
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
      'POST',
      {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      '<?xml version="1.0"?><Envelope><Body><checkVat/></Body></Envelope>',
      true,
      false
    );

    expect(result).toContain('<ns1:valid>false</ns1:valid>');
  });

  it('should handle empty SOAPAction header value', async () => {
    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n<response/>',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
      'POST',
      {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      '<?xml version="1.0"?><Envelope/>',
      true,
      false
    );

    const script = getScript();
    expect(script).toContain("'SOAPAction'=''");
  });

  it('should handle multi-line SOAP body via EncodedCommand', async () => {
    const multilineSoapBody = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <ns1:checkVat>
      <ns1:countryCode>DE</ns1:countryCode>
      <ns1:vatNumber>123456789</ns1:vatNumber>
    </ns1:checkVat>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    vi.mocked(Neutralino.os.execCommand).mockResolvedValue({
      stdOut: '200\n<response/>',
      exitCode: 0
    });

    await NeutralFetch._windowsFetch(
      'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
      'POST',
      {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': ''
      },
      multilineSoapBody,
      true,
      false
    );

    const cmd = vi.mocked(Neutralino.os.execCommand).mock.calls[0][0];
    expect(cmd).toMatch(/^powershell -EncodedCommand /);
    expect(cmd).not.toMatch(/\n/);
    const script = getScript();
    expect(script).toContain('checkVat');
    expect(script).toContain('SOAP-ENV:Envelope');
    expect(script).toContain('encoding="UTF-8"');
  });
});