require("dotenv").config();
const express = require("express");

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


// Create the responses table on first start (the Heroku Postgres add-on starts out empty).
pool.query(`CREATE TABLE IF NOT EXISTS survey_responses (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    iban TEXT NOT NULL,
    city TEXT,
    zip_code TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`, (err) => {
  if (err) {
    console.error('Failed to ensure survey_responses table exists:', err);
  } else {
    console.log('survey_responses table ready');
  }
});

// City and ZIP code were added on 2026-10-23; add the columns to an existing table without a reset.
// They stay nullable because rows collected before that date have no address data.
pool.query(`ALTER TABLE survey_responses
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS zip_code TEXT`, (err) => {
  if (err) {
    console.error('Failed to add city/zip_code columns:', err);
  } else {
    console.log('survey_responses city/zip_code columns ready');
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

        const { session_id, participant_id, name, email, iban } = req.body;
        const city = typeof req.body.city === "string" ? req.body.city.trim() : "";
        const zip_code = typeof req.body.zip_code === "string" ? req.body.zip_code.trim() : "";

        if (!session_id || !participant_id || !name || !email || !iban || !city || !zip_code) {
            console.error("Missing required fields in request data");
            return res.status(400).send("Bad Request: Missing required fields");
        }

        // Insert data into the database
        await pool.query(
            "INSERT INTO survey_responses (session_id, participant_id, name, email, iban, city, zip_code) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [session_id, participant_id, name, email, iban, city, zip_code]
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
