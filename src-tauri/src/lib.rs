// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(serde::Serialize, serde::Deserialize)]
struct VatValidationResult {
    valid: bool,
    country_code: String,
    vat_number: String,
    name: Option<String>,
    address: Option<String>,
    request_date: String,
}

#[tauri::command]
async fn validate_vat(country_code: String, vat_number: String) -> Result<VatValidationResult, String> {
    let url = format!(
        "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{}/vat/{}",
        country_code, vat_number
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let response_text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse the JSON response
    parse_vies_response(&response_text, &country_code, &vat_number)
}

fn parse_vies_response(response: &str, country_code: &str, vat_number: &str) -> Result<VatValidationResult, String> {
    let json: serde_json::Value = serde_json::from_str(response).map_err(|e| format!("JSON parse error: {}", e))?;

    let valid = json["isValid"].as_bool().ok_or("Missing 'isValid' field")?;
    let request_date = json["requestDate"].as_str().ok_or("Missing 'requestDate' field")?.to_string();
    let name = match json["name"].as_str() {
        Some("---") | None => None,
        Some(s) => Some(s.to_string()),
    };
    let address = match json["address"].as_str() {
        Some("---") | None => None,
        Some(s) => Some(s.to_string()),
    };

    Ok(VatValidationResult {
        valid,
        country_code: country_code.to_string(),
        vat_number: vat_number.to_string(),
        name,
        address,
        request_date,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, validate_vat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
