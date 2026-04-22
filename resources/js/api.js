import { isValidEUCountryCode, RateLimiter, createSOAPRequest, escapeShellArg, buildSOAPCurlCommand, isRateLimitedResponse, } from './utils.js';

// Global rate limiter instance for SOAP API
const soapRateLimiter = new RateLimiter(3, 100); 

/*
    Function to fetch VAT validation data from VIES API.
*/
export async function fetchVATData(countryCode, vatNumber) {
    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`;
    console.log('Validating:', countryCode, vatNumber, 'URL:', url);
    const maxRetries = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const command = `curl -s "${url}"`;
        const response = await Neutralino.os.execCommand(command);
        console.log(`API response exit code (attempt ${attempt}):`, response.exitCode);

        if (response.exitCode === 0) {
            return JSON.parse(response.stdOut);
        }

        if (attempt < maxRetries) {
            console.log(`Retry ${attempt} failed, waiting 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    throw new Error(`Failed to fetch VAT data after ${maxRetries} attempts`);
}

/*
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

/*
    Function to fetch VAT validation data from VIES SOAP API.
    Uses SOAP endpoint: https://ec.europa.eu/taxation_customs/vies/services/checkVatService
*/
export async function fetchVATDataSOAP(countryCode, vatNumber) {
    console.log('Validating via SOAP:', countryCode, vatNumber);
    
    const soapRequest = createSOAPRequest(countryCode, vatNumber);
    const url = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';
    const maxRetries = 10;
    const baseDelay = 2000; // Start with 2 seconds delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Apply rate limiting before making the request
        await soapRateLimiter.waitForSlot();
        
        // Build and execute curl command
        const command = buildSOAPCurlCommand(url, soapRequest);
        const response = await Neutralino.os.execCommand(command);
        console.log(`SOAP API response exit code (attempt ${attempt}):`, response.exitCode);

        if (response.exitCode === 0) {
            const xmlResponse = response.stdOut;
            
            // Check for rate limiting error first
            if (isRateLimitedResponse(xmlResponse)) {
                console.log(`SOAP API rate limited (MS_MAX_CONCURRENT_REQ), attempt ${attempt}`);
                if (attempt < maxRetries) {
                    // Exponential backoff for rate limiting
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    console.log(`Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    throw new Error(`SOAP API rate limited after ${maxRetries} retries`);
                }
            }
            
            // Parse the SOAP response
            const parseResult = parseSOAPResponse(xmlResponse);
            
            if (parseResult.error) {
                // Check if it's a rate limiting or server error that we should retry
                const faultString = parseResult.faultString || '';
                if (faultString.includes('SERVER_BUSY') || faultString.includes('SERVICE_UNAVAILABLE') || faultString.includes('MS_MAX_CONCURRENT_REQ')) {
                    console.log(`SOAP API server error: ${faultString}, attempt ${attempt}`);
                    if (attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(2, attempt - 1);
                        console.log(`Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
                
                // Log detailed error for debugging
                console.log('SOAP response (first 1000 chars):', xmlResponse.substring(0, 1000));
                throw new Error(parseResult.error);
            }
            
            // Successfully parsed response
            const { data } = parseResult;
            console.log('SOAP API parsed result:', { 
                isValid: data.isValid, 
                country: data.countryCode, 
                vatNum: data.vatNumber,
                name: data.name.substring(0, 50), 
                address: data.address.substring(0, 100),
                requestDate: data.requestDate 
            });
            
return data;
        } else {
            // Network/connection error (non-zero exit code)
            if (attempt < maxRetries) {
                // Exponential backoff for network errors
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`SOAP attempt ${attempt} failed (exit code: ${response.exitCode}), waiting ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(`Failed to fetch VAT data via SOAP after ${maxRetries} attempts`);

                    
}


/*
    Function to validate a VAT number with proper error handling.
    Returns an object with validation results.
*/
export async function validateVAT(countryCode, vatNumber) {
    const data = await fetchVATData(countryCode, vatNumber);
    return {
        valid: data.isValid,
        vatNumber: data.vatNumber,
        name: data.name || 'N/A',
        address: data.address || 'N/A',
        rawData: data
    };
}

/*
    Function to validate a VAT number using SOAP API.
    Returns an object with validation results.
*/
export async function validateVATSOAP(countryCode, vatNumber) {
    const data = await fetchVATDataSOAP(countryCode, vatNumber);
    return {
        valid: data.isValid,
        vatNumber: data.vatNumber,
        name: data.name,
        address: data.address,
        rawData: data
    };
}

/*
    Function to process VAT entry - validates format and fetches data from VIES API.
    For CSV processing with aggregated results.
*/
export async function processVATEntry(vatEntry) {
    if (vatEntry.length < 3) {
        return { result: { vat: vatEntry, valid: false, error: 'Invalid format' }, validInc: 0, invalidInc: 1 };
    }

    const countryCode = vatEntry.substring(0, 2).toUpperCase();
    const vatNumber = vatEntry.substring(2);

    if (!isValidEUCountryCode(countryCode)) {
        return { result: { vat: vatEntry, valid: false, error: 'Invalid EU country code' }, validInc: 0, invalidInc: 1 };
    }

    try {
        const data = await fetchVATData(countryCode, vatNumber);
        const isValid = data.isValid;
        return {
            result: {
                vat: vatEntry,
                valid: isValid,
                name: data.name || 'N/A',
                address: data.address || 'N/A'
            },
            validInc: isValid ? 1 : 0,
            invalidInc: isValid ? 0 : 1
        };
    } catch (error) {
        return { result: { vat: vatEntry, valid: false, error: error.message }, validInc: 0, invalidInc: 1 };
    }
}

/*
    Function to process VAT entry using SOAP API.
    For CSV processing with aggregated results.
*/
export async function processVATEntrySOAP(vatEntry) {
    if (vatEntry.length < 3) {
        return { result: { vat: vatEntry, valid: false, error: 'Invalid format' }, validInc: 0, invalidInc: 1 };
    }

    const countryCode = vatEntry.substring(0, 2).toUpperCase();
    const vatNumber = vatEntry.substring(2);

    if (!isValidEUCountryCode(countryCode)) {
        return { result: { vat: vatEntry, valid: false, error: 'Invalid EU country code' }, validInc: 0, invalidInc: 1 };
    }

    try {
        const data = await fetchVATDataSOAP(countryCode, vatNumber);
        const isValid = data.isValid;
        return {
            result: {
                vat: vatEntry,
                valid: isValid,
                name: data.name || 'N/A',
                address: data.address || 'N/A'
            },
            validInc: isValid ? 1 : 0,
            invalidInc: isValid ? 0 : 1
        };
    } catch (error) {
        return { result: { vat: vatEntry, valid: false, error: error.message }, validInc: 0, invalidInc: 1 };
    }
}

/*
    Function to limit concurrency of async tasks.
*/
export async function processWithConcurrency(tasks, concurrencyLimit, onProgress = () => {}) {
    const results = new Array(tasks.length);
    let index = 0;
    let running = 0;
    let resolveAll;
    const allDone = new Promise(resolve => resolveAll = resolve);

    const runNext = async () => {
        if (index >= tasks.length) {
            running--;
            if (running === 0) resolveAll();
            return;
        }

        const taskIndex = index++;
        running++;

        try {
            results[taskIndex] = await tasks[taskIndex]();
        } catch (error) {
            results[taskIndex] = { error };
        }

        onProgress(taskIndex);

        running--;
        if (running === 0 && index >= tasks.length) resolveAll();
        runNext();
    };

    for (let i = 0; i < concurrencyLimit && i < tasks.length; i++) {
        runNext();
    }

    await allDone;
    return results;
}

/*
    Function to process a batch of CSV lines concurrently.
*/
export async function processCSVBatch(lines, startIndex, progressBar, progressText, initialResults, initialValidCount, initialInvalidCount) {
    let results = [...initialResults];
    let validCount = initialValidCount;
    let invalidCount = initialInvalidCount;

    const processCSVLine = async (i) => {
        const line = lines[i].trim();
        if (!line) return { result: null, validInc: 0, invalidInc: 0 };

        const columns = line.split(',');
        if (columns.length === 0) return { result: null, validInc: 0, invalidInc: 0 };

        const vatEntry = columns[0].trim();
        return await processVATEntry(vatEntry);
    };

    const tasks = [];
    for (let i = startIndex; i < lines.length; i++) {
        tasks.push(() => processCSVLine(i));
    }

    const onProgress = (taskIndex) => {
        progressBar.value = startIndex + taskIndex + 1;
        progressText.textContent = `${progressBar.value}/${lines.length}`;
    };

    const taskResults = await processWithConcurrency(tasks, 20, onProgress);

    for (let res of taskResults) {
        if (res.result) {
            results.push(res.result);
        }
        validCount += res.validInc;
        invalidCount += res.invalidInc;
    }

    return { results, validCount, invalidCount };
}

/*
    Function to process a batch of CSV lines with SOAP API (lower concurrency).
*/
export async function processCSVBatchSOAP(lines, startIndex, progressBar, progressText, initialResults, initialValidCount, initialInvalidCount) {
    let results = [...initialResults];
    let validCount = initialValidCount;
    let invalidCount = initialInvalidCount;

    const processCSVLineSOAP = async (i) => {
        const line = lines[i].trim();
        if (!line) return { result: null, validInc: 0, invalidInc: 0 };

        const columns = line.split(',');
        if (columns.length === 0) return { result: null, validInc: 0, invalidInc: 0 };

        const vatEntry = columns[0].trim();
        return await processVATEntrySOAP(vatEntry);
    };

    const tasks = [];
    for (let i = startIndex; i < lines.length; i++) {
        tasks.push(() => processCSVLineSOAP(i));
    }

    const onProgress = (taskIndex) => {
        progressBar.value = startIndex + taskIndex + 1;
        progressText.textContent = `${progressBar.value}/${lines.length}`;
    };

    const taskResults = await processWithConcurrency(tasks, 10, onProgress);

    for (let res of taskResults) {
        if (res.result) {
            results.push(res.result);
        }
        validCount += res.validInc;
        invalidCount += res.invalidInc;
    }

    return { results, validCount, invalidCount };
}