// This is just a sample app. You can structure your Neutralinojs app code as you wish.
// This example app is written with vanilla JavaScript and HTML.
// Feel free to use any frontend framework you like :)
// See more details: https://neutralino.js.org/docs/how-to/use-a-frontend-library

import { showInfo, openDocs, openTutorial, setTray, onTrayMenuItemClicked, onWindowClose } from './app.js';
import { validateVATFromForm } from './vat.js';
import { downloadCSVTemplate, selectCSVFile, validateCSV, exportValidatedCSV } from './csv.js';

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

// Conditional initialization: Set up system tray if not running on macOS
if(NL_OS != "Darwin") { // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    const vatForm = document.getElementById('vat-form');
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    const selectCsvBtn = document.getElementById('select-csv-btn');
    const validateCsvBtn = document.getElementById('validate-csv-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    vatForm.addEventListener('submit', validateVATFromForm);
    downloadTemplateBtn.addEventListener('click', downloadCSVTemplate);
    selectCsvBtn.addEventListener('click', selectCSVFile);
    validateCsvBtn.addEventListener('click', validateCSV);
    exportCsvBtn.addEventListener('click', exportValidatedCSV);
});

// Display app information
// showInfo();
