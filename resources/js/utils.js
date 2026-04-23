import { EU_COUNTRIES } from './constants.js';

/*
    Function to validate if a country code is a valid EU country code.
*/
export function isValidEUCountryCode(countryCode) {
    return EU_COUNTRIES.includes(countryCode.toUpperCase());
}

export class RateLimiter {
    constructor(maxRequests = 3, timeWindow = 1000) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    async waitForSlot() {
        const now = Date.now();
        
        // Remove old requests outside the time window
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        // If we have reached the limit, wait
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.timeWindow - (now - oldestRequest);
            
            if (waitTime > 0) {
                console.log(`Rate limiting: waiting ${waitTime}ms before next request`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Update the timestamp after waiting
                this.requests.shift();
                this.requests.push(Date.now());
            }
        } else {
            this.requests.push(now);
        }
    }
}



/*
    Create SOAP request XML for VAT validation.
*/
export function createSOAPRequest(countryCode, vatNumber) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <SOAP-ENV:Body>
    <ns1:checkVat>
      <ns1:countryCode>${countryCode}</ns1:countryCode>
      <ns1:vatNumber>${vatNumber}</ns1:vatNumber>
    </ns1:checkVat>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/*
    Escape shell arguments for curl command.
*/
export function escapeShellArg(arg) {
    return arg.replace(/'/g, "'\"'\"'");
}

/*
    Build curl command for SOAP API call.
*/
export function buildSOAPCurlCommand(url, soapRequest) {
    const escapedRequest = escapeShellArg(soapRequest);
    return `curl -s -X POST "${url}" \\
  -H "Content-Type: text/xml; charset=utf-8" \\
  -H "SOAPAction: " \\
  --data '${escapedRequest}'`;
}

/*
    Check if response indicates rate limiting error.
*/
export function isRateLimitedResponse(xmlResponse) {
    return xmlResponse.includes('MS_MAX_CONCURRENT_REQ');
}


export const CSV_TEMPLATE = `EU VAT Number
DE123456789
FR12345678901
GB123456789
IT12345678901
ES123456789
NL123456789B01
PL1234567890
BE1234567890
ATU12345678
DK12345678`;


export /*
    Parse SOAP XML response using DOMParser.
*/
function parseSOAPResponse(xmlResponse) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlResponse, 'text/xml');
        
        // Check for SOAP fault
        const faultElement = xmlDoc.querySelector('Fault, fault, *|Fault');
        if (faultElement) {
            const faultString = faultElement.querySelector('faultstring, faultString')?.textContent || 'Unknown SOAP fault';
            return { error: `SOAP API error: ${faultString}`, faultString };
        }
        
        // Get checkVatResponse element (with or without namespace)
        const checkVatResponse = xmlDoc.querySelector('checkVatResponse, *|checkVatResponse');
        
        if (!checkVatResponse) {
            return { error: 'Invalid SOAP response format - missing checkVatResponse' };
        }
        
        // Extract required fields with namespace handling
        const getElementText = (elementName) => {
            // Try with namespace prefix first, then without
            const element = checkVatResponse.querySelector(`${elementName}, *|${elementName}`);
            return element ? element.textContent || '' : '';
        };
        
        const countryCodeText = getElementText('countryCode');
        const vatNumberText = getElementText('vatNumber');
        const requestDateText = getElementText('requestDate');
        const validText = getElementText('valid');
        const nameText = getElementText('name');
        const addressText = getElementText('address');
        
        if (!validText) {
            return { error: 'Invalid SOAP response format - missing valid element' };
        }
        
        const isValid = validText.toLowerCase() === 'true';
        const name = nameText.trim() || 'N/A';
        const address = addressText.trim() || 'N/A';
        const vatNum = vatNumberText || '';
        const country = countryCodeText || '';
        
        return {
            data: {
                isValid,
                vatNumber: `${country}${vatNum}`,
                name,
                address,
                countryCode: country,
                requestDate: requestDateText || new Date().toISOString()
            }
        };
        
    } catch (parseError) {
        console.error('Error parsing SOAP response:', parseError);
        return { error: `Failed to parse SOAP response: ${parseError.message}` };
    }
}


export function createRunner(args, fns, limit = 10, counter=()=>{}) {
  const results = new Array(args.length);
  let nextIndex = 0;
  let paused = false;
  let aborted = false;
  let pausePromise = null;
  let pauseResolve = null;

  function pause() {
    if (paused || aborted) return;
    paused = true;
    pausePromise = new Promise(resolve => {
      pauseResolve = resolve;
    });
  }

  function resume() {
    if (!paused) return;
    paused = false;
    pauseResolve?.();
    pausePromise = null;
    pauseResolve = null;
  }

  function abort() {
    aborted = true;
    // jeśli byliśmy w pauzie, odblokuj workery żeby mogły wyjść
    pauseResolve?.();
  }

  async function worker() {
    while (true) {
      if (aborted) return;
      if (paused) await pausePromise;
      if (aborted) return;

      const i = nextIndex++;
      if (i >= args.length) return;

      const fn = fns[i % fns.length];
      try {
        results[i] = await fn(args[i]);
        counter(i);
      } catch (err) {
        results[i] = { error: err };
      }
    }
  }

  const donePromise = Promise.all(
    Array.from({ length: Math.min(limit, args.length) }, worker)
  ).then(() => results);

  return {
    pause,
    resume,
    abort,
    done: donePromise,
    get progress() {
      return { completed: nextIndex, total: args.length, paused, aborted };
    },
  };
}