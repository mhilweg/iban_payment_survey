require("dotenv").config();
const express = require("express");
const isValidGermanTaxId = require("./public/tax-id.js");

const app = express();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Required for Heroku's Postgres
  },
});

// Ensure we're querying the correct schema
pool.query('SET search_path TO public', (err) => {
  if (err) {
    console.error('Failed to set search_path:', err);
  } else {
    console.log('search_path set to public schema');
  }
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully:', res.rows);
  }
});

// The tax identification number is only collected at HU Berlin; make sure the column exists
// (older deployments created the table without it). Empty for all other sites.
pool.query('ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS tax_id TEXT', (err) => {
  if (err) {
    console.error('Failed to ensure tax_id column exists:', err);
  }
});


// Middleware setup
app.use(express.static("public", { extensions: ['html', 'css', 'js'] }));
app.use(express.json());  // Handle JSON payloads directly

// Test database connection at startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
        process.exit(1); // Exit if the database connection fails
    } else {
        console.log('Database connected successfully:', res.rows);
    }
});

// API endpoint to handle form submissions
app.post("/api/submit", async (req, res) => {
    try {
        // Log incoming JSON data to verify structure
        console.log("Received form data:", req.body);

        const { session_id, participant_id, name, email, iban, university } = req.body;

        if (!session_id || !participant_id || !name || !email || !iban) {
            console.error("Missing required fields in request data");
            return res.status(400).send("Bad Request: Missing required fields");
        }

        // Tax identification number: required and validated at HU Berlin only, stored as NULL elsewhere
        let tax_id = null;
        if (university === "hu_berlin") {
            tax_id = String(req.body.tax_id || "").replace(/[\s/-]/g, "");
            if (!isValidGermanTaxId(tax_id)) {
                console.error("Missing or invalid tax_id for HU Berlin submission");
                return res.status(400).send("Bad Request: Missing or invalid tax identification number");
            }
        }

        // Insert data into the database
        await pool.query(
            "INSERT INTO survey_responses (session_id, participant_id, name, email, iban, tax_id) VALUES ($1, $2, $3, $4, $5, $6)",
            [session_id, participant_id, name, email, iban, tax_id]
        );

        res.status(200).send("Data submitted successfully");
    } catch (error) {
        console.error("Error submitting data:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Status endpoint: lets the oTree experiment verify that a participant has submitted payment data.
// Returns only a boolean, never any personal data.
app.get("/api/status", async (req, res) => {
    const { session_id, participant_id } = req.query;
    if (!session_id || !participant_id) {
        return res.status(400).json({ error: "Missing session_id or participant_id" });
    }
    try {
        const result = await pool.query(
            "SELECT 1 FROM survey_responses WHERE session_id = $1 AND participant_id = $2 LIMIT 1",
            [session_id, participant_id]
        );
        res.json({ submitted: result.rowCount > 0 });
    } catch (error) {
        console.error("Error checking submission status:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
