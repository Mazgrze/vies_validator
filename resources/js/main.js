// This is just a sample app. You can structure your Neutralinojs app code as you wish.
// This example app is written with vanilla JavaScript and HTML.
// Feel free to use any frontend framework you like :)
// See more details: https://neutralino.js.org/docs/how-to/use-a-frontend-library

// EU VAT country codes
const EU_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
];

/*
    Function to validate if a country code is a valid EU country code.
*/
function isValidEUCountryCode(countryCode) {
    return EU_COUNTRIES.includes(countryCode.toUpperCase());
}

/*
    Function to display information about the Neutralino app.
    This function updates the content of the 'info' element in the HTML
    with details regarding the running Neutralino application, including
    its ID, port, operating system, and version information.
*/
function showInfo() {
    document.getElementById('info').innerHTML = `
        ${NL_APPID} is running on port ${NL_PORT} inside ${NL_OS}
        <br/><br/>
        <span>server: v${NL_VERSION} . client: v${NL_CVERSION}</span>
        `;
}

/*
    Function to open the official Neutralino documentation in the default web browser.
*/
function openDocs() {
    Neutralino.os.open("https://neutralino.js.org/docs");
}

/*
    Function to open a tutorial video on Neutralino's official YouTube channel in the default web browser.
*/
function openTutorial() {
    Neutralino.os.open("https://www.youtube.com/c/CodeZri");
}

/*
    Function to validate VAT number using VIES REST API via curl to bypass CORS.
*/
async function validateVAT(countryCode, vatNumber, resultDiv) {
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
async function validateVATFromForm() {
    const countryCode = document.getElementById('country-code').value.trim().toUpperCase();
    const vatNumber = document.getElementById('vat-number').value.trim();
    const resultDiv = document.getElementById('validation-result');
    await validateVAT(countryCode, vatNumber, resultDiv);
}

let selectedCSVPath = null;

/*
    Function to download a CSV template file.
*/
async function downloadCSVTemplate() {
    const csvContent = `EU VAT Number
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

    try {
        // Use shell command to create the file in user's Downloads directory
        const homeDir = await Neutralino.os.getEnv('HOME') || await Neutralino.os.getEnv('USERPROFILE');
        const downloadsDir = `${homeDir}/Downloads`;
        const templatePath = `${downloadsDir}/vat_template.csv`;

        // Use printf to write the content (handles newlines better than echo)
        const escapedContent = csvContent.replace(/'/g, "'\\''"); // Escape single quotes
        const command = `mkdir -p "${downloadsDir}" && printf '%s\\n' '${escapedContent}' > "${templatePath}"`;

        const result = await Neutralino.os.execCommand(command);

        if (result.exitCode === 0) {
            Neutralino.os.showMessageBox('Success', `CSV template saved to: ${templatePath}`);
        } else {
            throw new Error(`Command failed: ${result.stdErr}`);
        }
    } catch (error) {
        console.error('Error saving template:', error);

        // Fallback: try to save to Desktop
        try {
            const homeDir = await Neutralino.os.getEnv('HOME') || await Neutralino.os.getEnv('USERPROFILE');
            const desktopPath = `${homeDir}/Desktop/vat_template.csv`;

            const escapedContent = csvContent.replace(/'/g, "'\\''");
            const command = `printf '%s\\n' '${escapedContent}' > "${desktopPath}"`;

            const result = await Neutralino.os.execCommand(command);

            if (result.exitCode === 0) {
                Neutralino.os.showMessageBox('Success', `CSV template saved to: ${desktopPath}`);
            } else {
                throw new Error(`Fallback command failed: ${result.stdErr}`);
            }
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
            Neutralino.os.showMessageBox('Error', 'Failed to save CSV template. Please check file permissions or create the file manually.');
        }
    }
}

/*
    Function to select CSV file using Neutralino file dialog.
*/
async function selectCSVFile() {
    try {
        const response = await Neutralino.os.showOpenDialog('Select CSV file', {
            filters: [
                {name: 'CSV files', extensions: ['csv']}
            ]
        });

        if (response && response.length > 0) {
            selectedCSVPath = response[0];
            document.getElementById('selected-file').innerHTML = `<p>Selected: ${selectedCSVPath}</p>`;
        }
    } catch (error) {
        console.error('Error selecting file:', error);
    }
}

/*
    Function to validate VAT numbers from CSV file.
*/
async function validateCSV() {
    const resultDiv = document.getElementById('csv-validation-result');

    if (!selectedCSVPath) {
        resultDiv.innerHTML = '<p style="color: red;">Please select a CSV file first.</p>';
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

        const results = [];
        let validCount = 0;
        let invalidCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Assume first column, split by comma
            const columns = line.split(',');
            if (columns.length === 0) continue;

            const vatEntry = columns[0].trim();
            if (vatEntry.length < 3) {
                results.push({ vat: vatEntry, valid: false, error: 'Invalid format' });
                invalidCount++;
                continue;
            }

            const countryCode = vatEntry.substring(0, 2).toUpperCase();
            const vatNumber = vatEntry.substring(2);

            if (!isValidEUCountryCode(countryCode)) {
                results.push({ vat: vatEntry, valid: false, error: 'Invalid EU country code' });
                invalidCount++;
                continue;
            }

            // Validate using VIES API
            try {
                const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`;
                console.log('Validating:', countryCode, vatNumber, 'URL:', url);
                const command = `curl -s "${url}"`;
                const response = await Neutralino.os.execCommand(command);
                console.log('API response exit code:', response.exitCode);

                if (response.exitCode !== 0) {
                    throw new Error(`Curl failed with exit code ${response.exitCode}: ${response.stdErr}`);
                }

                const data = JSON.parse(response.stdOut);
                const isValid = data.isValid;
                results.push({
                    vat: vatEntry,
                    valid: isValid,
                    name: data.name || 'N/A',
                    address: data.address || 'N/A'
                });

                if (isValid) {
                    validCount++;
                } else {
                    invalidCount++;
                }
            } catch (error) {
                console.error('Error validating VAT:', vatEntry, error);
                results.push({ vat: vatEntry, valid: false, error: 'API error' });
                invalidCount++;
            }
        }

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

    } catch (error) {
        console.error('Error processing CSV:', error);
        resultDiv.innerHTML = `<p style="color: red;">Error processing CSV file: ${error.message}. Please check the file format and try again.</p>`;
    }
}

/*
    Function to export validated results to CSV.
*/
async function exportValidatedCSV() {
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

        // Save to Downloads folder
        const homeDir = await Neutralino.os.getEnv('HOME') || await Neutralino.os.getEnv('USERPROFILE');
        const downloadsDir = `${homeDir}/Downloads`;
        const exportPath = `${downloadsDir}/validated_vat_results.csv`;

        // Use printf to write the content
        const escapedContent = csvContent.replace(/'/g, "'\\''"); // Escape single quotes for shell
        const command = `mkdir -p "${downloadsDir}" && printf '%s' '${escapedContent}' > "${exportPath}"`;

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

/*
    Function to set up a system tray menu with options specific to the window mode.
    This function checks if the application is running in window mode, and if so,
    it defines the tray menu items and sets up the tray accordingly.
*/
function setTray() {
    // Tray menu is only available in window mode
    if(NL_MODE != "window") {
        console.log("INFO: Tray menu is only available in the window mode.");
        return;
    }

    // Define tray menu items
    let tray = {
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            {id: "VERSION", text: "Get version"},
            {id: "SEP", text: "-"},
            {id: "QUIT", text: "Quit"}
        ]
    };

    // Set the tray menu
    Neutralino.os.setTray(tray);
}

/*
    Function to handle click events on the tray menu items.
    This function performs different actions based on the clicked item's ID,
    such as displaying version information or exiting the application.
*/
function onTrayMenuItemClicked(event) {
    switch(event.detail.id) {
        case "VERSION":
            // Display version information
            Neutralino.os.showMessageBox("Version information",
                `Neutralinojs server: v${NL_VERSION} | Neutralinojs client: v${NL_CVERSION}`);
            break;
        case "QUIT":
            // Exit the application
            Neutralino.app.exit();
            break;
    }
}

/*
    Function to handle the window close event by gracefully exiting the Neutralino application.
*/
function onWindowClose() {
    Neutralino.app.exit();
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

// Conditional initialization: Set up system tray if not running on macOS
if(NL_OS != "Darwin") { // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
}

// Display app information
// showInfo();
