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
                console.log(`Rate limiting: waiting ${waitTime}ms before next SOAP request`);
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