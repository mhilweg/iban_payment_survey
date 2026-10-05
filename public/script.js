document.addEventListener("DOMContentLoaded", () => {
    const sessionIdDisplay = document.getElementById("session-id-display");
    const participantIdDisplay = document.getElementById("participant-id-display");
    const sessionIdInput = document.getElementById("session-id");
    const participantIdInput = document.getElementById("participant-id");
    const universityInput = document.getElementById("university");
    const ibanInput = document.getElementById("iban");
    const ibanError = document.getElementById("iban-error");
    const taxIdGroup = document.getElementById("tax-id-group");
    const taxIdInput = document.getElementById("tax-id");
    const taxIdError = document.getElementById("tax-id-error");
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

    // Site the experiment is run at (passed by the experiment from its session config).
    // The tax identification number is only collected at HU Berlin.
    const university = urlParams.get("university") || "";
    const taxIdRequired = university === "hu_berlin";
    universityInput.value = university;
    if (taxIdRequired) {
        taxIdGroup.style.display = "block";
        taxIdInput.required = true;
    }

    // Optional return URL (passed by the experiment for participants who fill in the survey on their
    // own terminal). Only URLs pointing back to the experiment server are accepted.
    const allowedReturnOrigins = [
        "https://charity-lab-9f7c7b493bc8.herokuapp.com",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ];
    let returnUrl = null;
    const rawReturnUrl = urlParams.get("return_url");
    if (rawReturnUrl) {
        try {
            const parsed = new URL(rawReturnUrl);
            if (allowedReturnOrigins.includes(parsed.origin)) {
                returnUrl = parsed.href;
            } else {
                console.warn("Ignoring return_url with unexpected origin:", parsed.origin);
            }
        } catch {
            console.warn("Ignoring malformed return_url:", rawReturnUrl);
        }
    }
    const returnButton = document.getElementById("return-button");

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

    // Validate button logic: IBAN always, tax ID only when it is collected at this site
    validateButton.addEventListener("click", () => {
        const ibanOk = isValidIBAN(ibanInput.value);
        ibanError.style.display = ibanOk ? "none" : "block";

        let taxIdOk = true;
        if (taxIdRequired) {
            taxIdOk = isValidGermanTaxId(taxIdInput.value);
            taxIdError.style.display = taxIdOk ? "none" : "block";
        }

        submitButton.disabled = !(ibanOk && taxIdOk);
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
        if (taxIdRequired) {
            data.university = university;
            data.tax_id = taxIdInput.value.replace(/[\s/-]/g, "");
        }

        console.log("Submitting data:", data);

        try {
            const response = await fetch("/api/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const message = document.getElementById("message");
            if (response.ok) {
                form.reset();
                submitButton.disabled = true;  // Disable submit after success
                if (returnUrl) {
                    // Participant came from their own terminal: send them back to the experiment
                    message.textContent = "Submission successful! Click the button below to return to the experiment.";
                    returnButton.href = returnUrl;
                    returnButton.style.display = "inline-block";
                } else {
                    // Dedicated computer: unchanged behaviour
                    message.textContent = "Submission successful! Please wait until you are told to go back to your seat.";
                }
            } else {
                message.textContent = "An error occurred. Please try again.";
            }
        } catch (error) {
            console.error("Error submitting form:", error);
        }
    });
});
