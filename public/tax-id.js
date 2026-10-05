// Validation of the German tax identification number (Steuerliche Identifikationsnummer, "Steuer-ID").
// Shared by the browser (public/script.js) and the server (server.js).
//
// Rules (ISO 7064 Mod 11,10 check digit, as published by the Bundeszentralamt für Steuern):
//   - exactly 11 digits, the first digit is not 0
//   - within the first 10 digits exactly one digit occurs twice or three times, all others at most once
//     (three identical digits may not be directly consecutive)
//   - the 11th digit is the check digit
(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.isValidGermanTaxId = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    return function isValidGermanTaxId(value) {
        const id = String(value || "").replace(/[\s/-]/g, "");
        if (!/^[1-9][0-9]{10}$/.test(id)) {
            return false;
        }
        const digits = id.split("").map(Number);
        const body = digits.slice(0, 10);

        const counts = {};
        body.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
        const repeated = Object.keys(counts).filter(d => counts[d] > 1);
        if (repeated.length !== 1 || counts[repeated[0]] > 3) {
            return false;
        }
        if (counts[repeated[0]] === 3 && id.slice(0, 10).includes(repeated[0].repeat(3))) {
            return false;
        }

        let product = 10;
        for (const d of body) {
            let sum = (d + product) % 10;
            if (sum === 0) {
                sum = 10;
            }
            product = (sum * 2) % 11;
        }
        let check = 11 - product;
        if (check === 10) {
            check = 0;
        }
        return check === digits[10];
    };
});
