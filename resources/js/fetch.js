export class NeutralFetch {
  static async request(url, options = {}) {
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body || null;
    
    const platform = NL_OS; // 'Linux', 'Windows', 'Darwin'
    
    switch (platform) {
      case 'Windows':
        return this._windowsFetch(url, method, headers, body);
      case 'Linux':
      case 'Darwin':
        return this._unixFetch(url, method, headers, body);
    }
  }

  static async _unixFetch(url, method, headers, body) {
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
    if (status !== 200) {
      throw new Error(`HTTP ${status}: ${responseBody}`);
    }
    return JSON.parse(responseBody);
  }

  static async _windowsFetch(url, method, headers, body) {
    let headersStr = Object.entries(headers).map(([k, v]) => `"${k}"="${v}"`).join('; ');
    let cmd = `powershell -Command "$resp = Invoke-WebRequest -Uri '${url}' -Method ${method}`;
    if (headersStr) {
      cmd += ` -Headers @{${headersStr}}`;
    }
    if (body) {
      cmd += ` -Body '${body}'`;
    }
    cmd += `; Write-Host $resp.StatusCode; $resp.Content"`;
    const result = await Neutralino.os.execCommand(cmd);
    const lines = result.stdOut.trim().split('\n');
    const status = parseInt(lines.shift());
    const responseBody = lines.join('\n');
    if (status !== 200) {
      throw new Error(`HTTP ${status}: ${responseBody}`);
    }
    return JSON.parse(responseBody);
  }
}