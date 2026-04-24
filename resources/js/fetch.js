export class NeutralFetch {
  static async request(url, options = {}) {
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body || null;
    const throwOnError = options.throwOnError !== false;
    const parseJson = options.parseJson !== false;
    const forceCurl = options.forceCurl || false;

    const platform = NL_OS; // 'Linux', 'Windows', 'Darwin'

    if (forceCurl) {
      return this._unixFetch(url, method, headers, body, throwOnError, parseJson);
    }

    switch (platform) {
      case 'Windows':
        return this._windowsFetch(url, method, headers, body, throwOnError, parseJson);
      case 'Linux':
      case 'Darwin':
        return this._unixFetch(url, method, headers, body, throwOnError, parseJson);
    }
  }

  static async _unixFetch(url, method, headers, body, throwOnError, parseJson) {
    let headerArgs = Object.entries(headers)
      .map(([k, v]) => `-H "${k}: ${v}"`)
      .join(' ');

    let cmd = `curl -s -w "\\n%{http_code}"`;
    if (method !== 'GET') {
      cmd += ` -X ${method}`;
    }
    cmd += ` ${headerArgs}`;
    if (body) {
      cmd += ` --data-binary '${body}'`;
    }
    cmd += ` ${url}`;

    const result = await Neutralino.os.execCommand(cmd);
    const lines = result.stdOut.trim().split('\n');
    const status = parseInt(lines.pop());
    const responseBody = lines.join('\n');
    let parsedBody = responseBody;
    if (parseJson && status === 200) {
      try {
        parsedBody = JSON.parse(responseBody);
      } catch (e) {
        // If JSON parsing fails, keep as raw string
      }
    }
    if (throwOnError && status !== 200) {
      throw new Error(`HTTP ${status}: ${parsedBody}`);
    }
    return throwOnError ? parsedBody : { status, body: parsedBody };
  }

  static _encodeUtf16Base64(str) {
    let bytes = '';
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      bytes += String.fromCharCode(code & 0xFF, (code >> 8) & 0xFF);
    }
    return btoa(bytes);
  }

  static async _windowsFetch(url, method, headers, body, throwOnError, parseJson) {
    let headersStr = Object.entries(headers).map(([k, v]) => `'${k}'='${v}'`).join('; ');
    let headersPart = headersStr ? `-Headers @{${headersStr}}` : '';
    let bodyPart = body ? `-Body '${body.replace(/'/g, "''")}'` : '';
    let script = `$resp = Invoke-WebRequest -UseBasicParsing -Uri '${url}' -Method ${method} ${headersPart} ${bodyPart}; Write-Host $resp.StatusCode; $resp.Content`;
    let cmd = `powershell -EncodedCommand ${this._encodeUtf16Base64(script)}`;
    const result = await Neutralino.os.execCommand(cmd);
    const lines = result.stdOut.trim().split('\n');
    const status = parseInt(lines.shift());
    const responseBody = lines.join('\n');
    let parsedBody = responseBody;
    if (parseJson && status === 200) {
      try {
        parsedBody = JSON.parse( cleanStringForJSON(responseBody));
      } catch (e) {
        // If JSON parsing fails, keep as raw string
      }
    }
    if (throwOnError && status !== 200) {
      throw new Error(`HTTP ${status}: ${parsedBody}`);
    }
    return throwOnError ? parsedBody : { status, body: parsedBody };
  }
}