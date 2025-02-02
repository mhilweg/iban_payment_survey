document.addEventListener("DOMContentLoaded", () => {
    const sessionIdDisplay = document.getElementById("session-id-display");
    const participantIdDisplay = document.getElementById("participant-id-display");
    const sessionIdInput = document.getElementById("session-id");
    const participantIdInput = document.getElementById("participant-id");
    const ibanInput = document.getElementById("iban");
    const ibanError = document.getElementById("iban-error");
    const submitButton = document.getElementById("submit-button");
    const validateButton = document.getElementById("validate-button");

    // Populate IDs from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get("session_id");
    const participantId = urlParams.get("participant_id");

    sessionIdDisplay.textContent = sessionId || "N/A";
    participantIdDisplay.textContent = participantId || "N/A";
    sessionIdInput.value = sessionId;
    participantIdInput.value = participantId;

    // IBAN country-specific lengths
    const ibanCountryLengths = {
        AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
        EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
        IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31,
        NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24
    };

    function isValidIBAN(iban) {
        iban = iban.replace(/\s+/g, '').toUpperCase();

        const ibanRegex = /^[A-Z0-9]+$/;
        if (!ibanRegex.test(iban) || iban.length < 15 || iban.length > 34) {
            return false;
        }

        const countryCode = iban.slice(0, 2);
        const expectedLength = ibanCountryLengths[countryCode];
        if (!expectedLength || iban.length !== expectedLength) {
            return false;
        }

        const rearranged = iban.slice(4) + iban.slice(0, 4);
        const numericIBAN = rearranged.split('')
            .map(char => (isNaN(char) ? char.charCodeAt(0) - 55 : char))
            .join('');

        try {
            return BigInt(numericIBAN) % 97n === 1n;
        } catch {
            return false;
        }
    }

    // Validate button logic
    validateButton.addEventListener("click", () => {
        if (isValidIBAN(ibanInput.value)) {
            ibanError.style.display = "none";
            submitButton.disabled = false;
        } else {
            ibanError.style.display = "block";
            submitButton.disabled = true;
        }
    });

    // Form submission
    const form = document.getElementById("payment-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const data = {
            session_id: sessionIdInput.value,
            participant_id: participantIdInput.value,
            name: form.elements["name"].value,
            email: form.elements["email"].value,
            iban: ibanInput.value
        };

        console.log("Submitting data:", data);

        try {
            const response = await fetch("/api/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const message = document.getElementById("message");
            if (response.ok) {
                message.textContent = "Submission successful!";
                form.reset();
                submitButton.disabled = true;  // Disable submit after success
            } else {
                message.textContent = "An error occurred. Please try again.";
            }
        } catch (error) {
            console.error("Error submitting form:", error);
        }
    });
});
