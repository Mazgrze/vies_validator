const soap = require('soap');

document.getElementById('validateBtn').addEventListener('click', async () => {
    const vatNumber = document.getElementById('vatInput').value.trim();
    const resultDiv = document.getElementById('result');
    
    if (!vatNumber) {
        resultDiv.textContent = 'Please enter a VAT number.';
        return;
    }
    
    resultDiv.textContent = 'Validating...';
    
    try {
        const isValid = await validateVat(vatNumber);
        resultDiv.textContent = isValid ? 'Valid VAT number.' : 'Invalid VAT number.';
    } catch (error) {
        resultDiv.textContent = 'Error validating VAT number: ' + error.message;
    }
});

async function validateVat(vatNumber) {
    const url = 'http://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl';
    
    // Extract country code and VAT number
    const countryCode = vatNumber.substring(0, 2).toUpperCase();
    const vatNum = vatNumber.substring(2);
    
    return new Promise((resolve, reject) => {
        soap.createClient(url, (err, client) => {
            if (err) {
                reject(new Error('Failed to create SOAP client: ' + err.message));
                return;
            }
            
            client.checkVat({ countryCode, vatNumber: vatNum }, (err, result) => {
                if (err) {
                    reject(new Error('SOAP call failed: ' + err.message));
                    return;
                }
                
                resolve(result.valid);
            });
        });
    });
}
