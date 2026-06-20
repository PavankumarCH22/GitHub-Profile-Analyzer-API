// Main Application Entry Point
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const githubService = require('./githubService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsing
app.use(cors());
app.use(express.json());

// Serve front-end static files
app.use(express.static(path.join(__dirname, 'public')));

// Lazy database initialization middleware (crucial for Vercel/serverless environments)
let dbInitialized = false;
let dbInitializationPromise = null;

async function ensureDbInitialized() {
  if (dbInitialized) return;
  if (!dbInitializationPromise) {
    dbInitializationPromise = db.initializeDatabase()
      .then(() => {
        dbInitialized = true;
        dbInitializationPromise = null;
      })
      .catch((err) => {
        dbInitializationPromise = null; // retry on next request if it fails
        throw err;
      });
  }
  await dbInitializationPromise;
}

app.use(async (req, res, next) => {
  // Only try initializing database for API routes
  if (req.path.startsWith('/api')) {
    try {
      await ensureDbInitialized();
    } catch (err) {
      console.error('Lazy database initialization failed:', err.message);
    }
  }
  next();
});

/**
 * 1. Analyze and store/update profile
 * POST /api/profiles/:username
 */
app.post('/api/profiles/:username', async (req, res) => {
  const username = req.params.username.trim();
  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required.' });
  }

  try {
    console.log(`Analyzing GitHub profile for user: ${username}...`);
    const analysis = await githubService.analyzeUserProfile(username);

    // Check if profile already exists in DB
    const existing = await db.query('SELECT id FROM profiles WHERE username = ?', [analysis.username]);

    const params = [
      analysis.username,
      analysis.name,
      analysis.avatar_url,
      analysis.html_url,
      analysis.bio,
      analysis.company,
      analysis.blog,
      analysis.location,
      analysis.email,
      analysis.public_repos,
      analysis.public_gists,
      analysis.followers,
      analysis.following,
      analysis.github_created_at ? new Date(analysis.github_created_at) : null,
      analysis.github_updated_at ? new Date(analysis.github_updated_at) : null,
      analysis.total_stars,
      JSON.stringify(analysis.top_languages),
      JSON.stringify(analysis.top_repositories)
    ];

    if (existing.length > 0) {
      console.log(`Updating existing analysis for ${analysis.username} in database.`);
      await db.query(`
        UPDATE profiles SET
          name = ?,
          avatar_url = ?,
          html_url = ?,
          bio = ?,
          company = ?,
          blog = ?,
          location = ?,
          email = ?,
          public_repos = ?,
          public_gists = ?,
          followers = ?,
          following = ?,
          github_created_at = ?,
          github_updated_at = ?,
          total_stars = ?,
          top_languages = ?,
          top_repositories = ?,
          analyzed_at = CURRENT_TIMESTAMP
        WHERE username = ?
      `, [
        analysis.name,
        analysis.avatar_url,
        analysis.html_url,
        analysis.bio,
        analysis.company,
        analysis.blog,
        analysis.location,
        analysis.email,
        analysis.public_repos,
        analysis.public_gists,
        analysis.followers,
        analysis.following,
        analysis.github_created_at ? new Date(analysis.github_created_at) : null,
        analysis.github_updated_at ? new Date(analysis.github_updated_at) : null,
        analysis.total_stars,
        JSON.stringify(analysis.top_languages),
        JSON.stringify(analysis.top_repositories),
        analysis.username
      ]);
    } else {
      console.log(`Inserting new analysis for ${analysis.username} into database.`);
      await db.query(`
        INSERT INTO profiles (
          username, name, avatar_url, html_url, bio, company, blog, location, email,
          public_repos, public_gists, followers, following, github_created_at, github_updated_at,
          total_stars, top_languages, top_repositories
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, params);
    }

    // Retrieve fresh data to ensure consistent return format
    const results = await db.query('SELECT * FROM profiles WHERE username = ?', [analysis.username]);
    const profile = results[0];

    // Safely parse JSON columns
    if (profile.top_languages && typeof profile.top_languages === 'string') {
      profile.top_languages = JSON.parse(profile.top_languages);
    }
    if (profile.top_repositories && typeof profile.top_repositories === 'string') {
      profile.top_repositories = JSON.parse(profile.top_repositories);
    }

    res.status(200).json({
      message: existing.length > 0 ? 'Analysis updated successfully.' : 'Analysis completed and saved.',
      profile
    });
  } catch (error) {
    console.error(`Error analyzing profile for ${username}:`, error.message);
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

/**
 * 2. Fetch all stored analyzed profiles
 * GET /api/profiles
 */
app.get('/api/profiles', async (req, res) => {
  try {
    const profiles = await db.query('SELECT * FROM profiles ORDER BY analyzed_at DESC');
    
    // Parse JSON fields
    profiles.forEach(profile => {
      if (profile.top_languages && typeof profile.top_languages === 'string') {
        profile.top_languages = JSON.parse(profile.top_languages);
      }
      if (profile.top_repositories && typeof profile.top_repositories === 'string') {
        profile.top_repositories = JSON.parse(profile.top_repositories);
      }
    });

    res.status(200).json(profiles);
  } catch (error) {
    console.error('Error fetching profiles list:', error.message);
    res.status(500).json({ error: 'Failed to fetch profiles from database. Make sure MySQL is connected.' });
  }
});

/**
 * 3. Fetch data of a single profile
 * GET /api/profiles/:username
 */
app.get('/api/profiles/:username', async (req, res) => {
  const username = req.params.username.trim();
  try {
    const results = await db.query('SELECT * FROM profiles WHERE username = ?', [username]);
    if (results.length === 0) {
      return res.status(404).json({
        error: `Profile '${username}' has not been analyzed yet. Use POST /api/profiles/${username} to fetch and analyze it.`
      });
    }

    const profile = results[0];
    if (profile.top_languages && typeof profile.top_languages === 'string') {
      profile.top_languages = JSON.parse(profile.top_languages);
    }
    if (profile.top_repositories && typeof profile.top_repositories === 'string') {
      profile.top_repositories = JSON.parse(profile.top_repositories);
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error(`Error fetching profile ${username}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch profile from database.' });
  }
});

/**
 * 4. Delete analysis results (Bonus API)
 * DELETE /api/profiles/:username
 */
app.delete('/api/profiles/:username', async (req, res) => {
  const username = req.params.username.trim();
  try {
    const results = await db.query('SELECT id FROM profiles WHERE username = ?', [username]);
    if (results.length === 0) {
      return res.status(404).json({ error: `Profile '${username}' not found in database.` });
    }

    await db.query('DELETE FROM profiles WHERE username = ?', [username]);
    res.status(200).json({ message: `Analysis profile for '${username}' has been deleted.` });
  } catch (error) {
    console.error(`Error deleting profile ${username}:`, error.message);
    res.status(500).json({ error: 'Failed to delete profile from database.' });
  }
});

// Middleware for fallback database error message on API calls if not connected
app.use('/api', (req, res, next) => {
  res.status(503).json({ error: 'Database is not initialized or connected. Please check your credentials.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

/**
 * Start the Express server after initializing database
 */
async function startServer() {
  try {
    await db.initializeDatabase();
    dbInitialized = true; // Mark as initialized to prevent redundant middleware initialization
    app.listen(PORT, () => {
      console.log(`\n==================================================================`);
      console.log(`GitHub Profile Analyzer API is running at: http://localhost:${PORT}`);
      console.log(`==================================================================\n`);
    });
  } catch (error) {
    console.warn('\nStarting Express server in SAFE MODE due to database connection failure.');
    console.warn(`Endpoints requiring database will return 500/503 errors until DB is fixed.\n`);

    // Listen on PORT anyway so developers can view logs and hit verification URLs
    app.listen(PORT, () => {
      console.log(`GitHub Profile Analyzer (Safe Mode) running at: http://localhost:${PORT}`);
    });
  }
}

// Bypasses local app.listen() when imported as a serverless function module on Vercel
if (require.main === module) {
  startServer();
}

module.exports = app;
