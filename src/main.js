const { invoke } = window.__TAURI__.core;

document.getElementById('vatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const countryCode = document.getElementById('countryCode').value.trim().toUpperCase();
    const vatNumber = document.getElementById('vatNumber').value.trim();
    const resultDiv = document.getElementById('result');

    resultDiv.textContent = 'Validating...';
    resultDiv.style.color = 'black';

    try {
        const result = await invoke('validate_vat', { countryCode, vatNumber });
        if (result.valid) {
            resultDiv.textContent = 'VAT is valid!';
            resultDiv.style.color = 'green';
        } else {
            resultDiv.textContent = 'VAT is invalid.';
            resultDiv.style.color = 'red';
        }
    } catch (error) {
        resultDiv.textContent = 'Error: ' + error;
        resultDiv.style.color = 'red';
    }
});