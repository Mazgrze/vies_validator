import { useState } from "react";
import reactLogo from "./assets/react.svg";
// import { invoke } from "@tauri-apps/api/core";
// import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [vatResult, setVatResult] = useState(null);
  const [countryCode, setCountryCode] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [loading, setLoading] = useState(false);

  async function validateVat() {
    setLoading(true);
    try {
      const result = await invoke("validate_vat", { countryCode, vatNumber });
      setVatResult(result);
    } catch (error) {
      setVatResult({ error: error.toString() });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>VAT EU Validator</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <div className="vat-validation-section">
        <h2>Validate EU VAT Number</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            validateVat();
          }}
        >
          <input
            type="text"
            placeholder="Country Code (e.g., DE)"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
            maxLength="2"
          />
          <input
            type="text"
            placeholder="VAT Number"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Validating..." : "Validate"}
          </button>
        </form>

        {vatResult && (
          <div className="vat-result">
            {vatResult.error ? (
              <p className="error">Error: {vatResult.error}</p>
            ) : (
              <div>
                <p><strong>Valid:</strong> {vatResult.valid ? "Yes" : "No"}</p>
                <p><strong>Country:</strong> {vatResult.country_code}</p>
                <p><strong>VAT Number:</strong> {vatResult.vat_number}</p>
                <p><strong>Request Date:</strong> {vatResult.request_date}</p>
                {vatResult.name && <p><strong>Name:</strong> {vatResult.name}</p>}
                {vatResult.address && <p><strong>Address:</strong> {vatResult.address}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
