// This is just a sample app. You can structure your Neutralinojs app code as you wish.
// This example app is written with vanilla JavaScript and HTML.
// Feel free to use any frontend framework you like :)
// See more details: https://neutralino.js.org/docs/how-to/use-a-frontend-library

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
async function validateVAT() {
    const countryCode = document.getElementById('country-code').value.trim().toUpperCase();
    const vatNumber = document.getElementById('vat-number').value.trim();
    const resultDiv = document.getElementById('validation-result');

    if (!countryCode || !vatNumber) {
        resultDiv.innerHTML = '<p style="color: red;">Please enter both country code and VAT number.</p>';
        return;
    }

    if (countryCode.length !== 2) {
        resultDiv.innerHTML = '<p style="color: red;">Country code must be 2 letters.</p>';
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
showInfo();
