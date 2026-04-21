import { isValidEUCountryCode } from './utils.js';

/*
    Function to validate VAT number using VIES REST API via curl to bypass CORS.
*/
export async function validateVAT(countryCode, vatNumber, resultDiv) {
    if (!countryCode || !vatNumber) {
        resultDiv.innerHTML = '<p style="color: red;">Please enter both country code and VAT number.</p>';
        return;
    }

    if (countryCode.length !== 2) {
        resultDiv.innerHTML = '<p style="color: red;">Country code must be 2 letters.</p>';
        return;
    }

    if (!isValidEUCountryCode(countryCode)) {
        resultDiv.innerHTML = '<p style="color: red;">Invalid EU country code.</p>';
        return;
    }

    resultDiv.innerHTML = '<p>Validating...</p>';

    try {
        const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`;
        const command = `curl -s "${url}"`;
        const response = await Neutralino.os.execCommand(command);

        if (response.exitCode !== 0) {
            throw new Error(`Curl failed with exit code ${response.exitCode}: ${response.stdErr}`);
        }

        const data = JSON.parse(response.stdOut);

        if (data.isValid) {
            resultDiv.innerHTML = `<p style="color: green;">VAT number ${data.vatNumber} is valid.</p><p>Name: ${data.name || 'N/A'}</p><p>Address: ${data.address || 'N/A'}</p>`;
        } else {
            resultDiv.innerHTML = '<p style="color: red;">VAT number is invalid or not found.</p>';
        }
    } catch (error) {
        console.error('Error validating VAT:', error);
        resultDiv.innerHTML = '<p style="color: red;">Error validating VAT. Please try again later.</p>';
    }
}

/*
    Wrapper function for single VAT validation from form input.
*/
export async function validateVATFromForm(e) {
    e.preventDefault();
    const countryCode = document.getElementById('country-code').value.trim().toUpperCase();
    const vatNumber = document.getElementById('vat-number').value.trim();
    const resultDiv = document.getElementById('validation-result');
    await validateVAT(countryCode, vatNumber, resultDiv);
}