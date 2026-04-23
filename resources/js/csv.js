import { processCSVBatchDualApi } from './api.js';
import { CSV_TEMPLATE } from './utils.js';

let selectedCSVPath = null;
let validationRunning = false;
let validationPaused = false;

const resultDiv = document.getElementById('csv-validation-result');
const progressBar = document.getElementById('validation-progress');
const progressText = document.getElementById('progress-text');
const pauseBtn = document.getElementById('pause-validation-btn');
const resumeBtn = document.getElementById('resume-validation-btn');
const exportBtn = document.getElementById('export-csv-btn');
const validateBtn = document.getElementById('validate-csv-btn');


function saveValidationState(lines, currentIndex, results, validCount, invalidCount) {
    localStorage.setItem('validationState', JSON.stringify({
        lines,
        currentIndex,
        results,
        validCount,
        invalidCount,
        selectedCSVPath
    }));
}

function loadValidationState() {
    const state = localStorage.getItem('validationState');
    return state ? JSON.parse(state) : null;
}

function clearValidationState() {
    localStorage.removeItem('validationState');
}

export function pauseValidation() {
    validationPaused = true;
}

export async function resumeValidation() {
    const state = loadValidationState();
    if (!state) {
        alert('No paused validation to resume.');
        return;
    }
    selectedCSVPath = state.selectedCSVPath;
    document.getElementById('selected-file').innerHTML = `<p>Selected: ${selectedCSVPath}</p>`;
    await performValidation(state.lines, state.currentIndex, state.results, state.validCount, state.invalidCount);
}

/*
    Function to download a CSV template file.
*/
export async function downloadCSVTemplate() {
    

    try {
        // Get home directory for default path suggestion
        const homeDir = await Neutralino.os.getEnv('HOME') || await Neutralino.os.getEnv('USERPROFILE');
        const defaultPath = `vat_template.csv`;

        // Show native save dialog
        const templatePath = await Neutralino.os.showSaveDialog('Save CSV Template', {
            defaultPath: defaultPath,
            filters: [
                {name: 'CSV files', extensions: ['csv']}
            ]
        });

        if (!templatePath) {
            // User cancelled the dialog
            return;
        }

        // Ensure the directory exists
        const dir = templatePath.substring(0, templatePath.lastIndexOf('/'));
        const escapedContent = CSV_TEMPLATE.replace(/'/g, "'\\''"); // Escape single quotes
        const command = `mkdir -p "${dir}" && printf '%s\\n' '${escapedContent}' > "${templatePath}"`;

        const result = await Neutralino.os.execCommand(command);

        if (result.exitCode === 0) {
            Neutralino.os.showMessageBox('Success', `CSV template saved to: ${templatePath}`);
        } else {
            throw new Error(`Command failed: ${result.stdErr}`);
        }
    } catch (error) {
        console.error('Error saving template:', error);
        Neutralino.os.showMessageBox('Error', 'Failed to save CSV template. Please check file permissions or try a different location.');
    }
}

/*
    Function to select CSV file using Neutralino file dialog.
*/
export async function selectCSVFile() {
    try {
        const response = await Neutralino.os.showOpenDialog('Select CSV file', {
            filters: [
                {name: 'CSV files', extensions: ['csv']}
            ]
        });

        if (response && response.length > 0) {
            selectedCSVPath = response[0];
            document.getElementById('selected-file').innerHTML = `<p>Selected: ${selectedCSVPath}</p>`;

            // Reset validation state when selecting a new file
            clearValidationState();
            validationRunning = false;
            validationPaused = false;

            // Reset UI


            resultDiv.innerHTML = '';
            progressBar.style.display = 'none';
            progressBar.value = 0;
            progressText.style.display = 'none';
            progressText.textContent = '';
            pauseBtn.style.display = 'none';
            resumeBtn.style.display = 'none';
            exportBtn.style.display = 'none';
            validateBtn.disabled = false;

            // Clear previous results
            window.lastValidationResults = null;
        }
    } catch (error) {
        console.error('Error selecting file:', error);
    }
}

/*
    Function to display validation results in HTML table.
*/
function displayValidationResults(results, validCount, invalidCount, resultDiv) {
    // Display results
    let html = `<p>Validation complete. Valid: ${validCount}, Invalid: ${invalidCount}</p>`;
    html += '<table border="1" style="border-collapse: collapse;"><tr><th>VAT Number</th><th>Valid</th><th>Name</th><th>Address</th></tr>';

    for (const result of results) {
        const color = result.valid ? 'green' : 'red';
        const status = result.valid ? 'Yes' : (result.error || 'No');
        html += `<tr style="color: ${color};"><td>${result.vat}</td><td>${status}</td><td>${result.name || ''}</td><td>${result.address || ''}</td></tr>`;
    }

    html += '</table>';
    resultDiv.innerHTML = html;

    // Store results for export
    window.lastValidationResults = results;

    // Show export button
    document.getElementById('export-csv-btn').style.display = 'inline-block';
}



/*
    Function to validate VAT numbers from CSV file.
*/
export async function validateCSV() {
    const resultDiv = document.getElementById('csv-validation-result');

    if (!selectedCSVPath) {
        resultDiv.innerHTML = '<p style="color: red;">Please select a CSV file first.</p>';
        return;
    }

    // Check if there's a paused validation to resume
    const savedState = loadValidationState();
    if (savedState && savedState.selectedCSVPath === selectedCSVPath) {
        await resumeValidation();
        return;
    }

    resultDiv.innerHTML = '<p>Reading and validating CSV...</p>';

    try {
        console.log('Selected CSV path:', selectedCSVPath);
        // Read the file content
        const fileContent = await Neutralino.filesystem.readFile(selectedCSVPath);
        console.log('File content length:', fileContent.length);
        const lines = fileContent.split('\n').slice(1).filter(line => line.trim() !== '');
        console.log('Number of lines:', lines.length);

        if (lines.length === 0) {
            resultDiv.innerHTML = '<p style="color: red;">CSV file is empty.</p>';
            return;
        }

        await performValidation(lines, 0, [], 0, 0);

    } catch (error) {
        console.error('Error processing CSV:', error);
        resultDiv.innerHTML = `<p style="color: red;">Error processing CSV file: ${error.message}. Please check the file format and try again.</p>`;
        const progressBar = document.getElementById('validation-progress');
        const progressText = document.getElementById('progress-text');
        progressBar.style.display = 'none';
        progressText.style.display = 'none';
    }
}


function updater(idx, total) {
     progressBar.value = idx+1;
    progressText.textContent = `${idx+1}/${total}`;
}


/*
    Function to perform the validation loop, can be resumed.
*/
async function performValidation(lines, startIndex, initialResults, initialValidCount, initialInvalidCount) {


    resultDiv.innerHTML = '<p>Validation in progress...</p>';

    validationRunning = true;
    validationPaused = false;

    progressBar.max = lines.length;
    progressBar.value = startIndex;
    progressText.textContent = `${startIndex}/${lines.length}`;
    progressBar.style.display = 'block';
    progressText.style.display = 'block';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    validateBtn.disabled = true;

    let results = [...initialResults];
    let validCount = initialValidCount;
    let invalidCount = initialInvalidCount;

    try {

        

        const batchResult = await processCSVBatchDualApi(lines, (i)=>updater(i, lines.length));
        results = batchResult.results;
        validCount = batchResult.validCount;
        invalidCount = batchResult.invalidCount;

        // Finished
        clearValidationState();
        progressBar.style.display = 'none';
        progressText.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        validateBtn.disabled = false;
        displayValidationResults(results, validCount, invalidCount, resultDiv);
        validationRunning = false;

    } catch (error) {
        console.error('Error during validation:', error);
        resultDiv.innerHTML = `<p style="color: red;">Error during validation: ${error.message}</p>`;
        progressBar.style.display = 'none';
        progressText.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        validateBtn.disabled = false;
        validationRunning = false;
    }
}

/*
    Function to export validated results to CSV.
*/
export async function exportValidatedCSV() {
    if (!window.lastValidationResults || window.lastValidationResults.length === 0) {
        Neutralino.os.showMessageBox('Error', 'No validation results to export. Please validate a CSV file first.');
        return;
    }

    try {
        // Create CSV content
        let csvContent = 'VAT Number,Valid,Name,Address\n';

        for (const result of window.lastValidationResults) {
            const status = result.valid ? 'Yes' : (result.error || 'No');
            const name = (result.name || '').replace(/"/g, '""'); // Escape quotes
            const address = (result.address || '').replace(/"/g, '""'); // Escape quotes

            // Wrap fields containing commas or quotes in double quotes
            const vatField = result.vat.includes(',') || result.vat.includes('"') ? `"${result.vat}"` : result.vat;
            const nameField = name.includes(',') || name.includes('"') ? `"${name}"` : name;
            const addressField = address.includes(',') || address.includes('"') ? `"${address}"` : address;

            csvContent += `${vatField},${status},${nameField},${addressField}\n`;
        }

        // Show native save dialog
        const homeDir = await Neutralino.os.getEnv('HOME') || await Neutralino.os.getEnv('USERPROFILE');
        const defaultPath = `validated_vat_results.csv`;

        const exportPath = await Neutralino.os.showSaveDialog('Save Validation Results', {
            defaultPath: defaultPath,
            filters: [
                {name: 'CSV files', extensions: ['csv']}
            ]
        });

        if (!exportPath) {
            // User cancelled the dialog
            return;
        }

        // Ensure the directory exists
        const dir = exportPath.substring(0, exportPath.lastIndexOf('/'));
        const escapedContent = csvContent.replace(/'/g, "'\\''"); // Escape single quotes
        const command = `mkdir -p "${dir}" && printf '%s\\n' '${escapedContent}' > "${exportPath}"`;

        const result = await Neutralino.os.execCommand(command);

        if (result.exitCode === 0) {
            Neutralino.os.showMessageBox('Success', `Validation results exported to: ${exportPath}`);
        } else {
            throw new Error(`Command failed: ${result.stdErr}`);
        }
    } catch (error) {
        console.error('Error exporting CSV:', error);
        Neutralino.os.showMessageBox('Error', 'Failed to export CSV results.');
    }
}