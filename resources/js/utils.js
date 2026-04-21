import { EU_COUNTRIES } from './constants.js';

/*
    Function to validate if a country code is a valid EU country code.
*/
export function isValidEUCountryCode(countryCode) {
    return EU_COUNTRIES.includes(countryCode.toUpperCase());
}