# GitHub Profile Analyzer API

A robust backend REST service built in Node.js, Express.js, and MySQL. It analyzes any public GitHub user profile using the public GitHub API, extracts rich profile intelligence (such as total repository star counts, primary programming language distribution, and top starred repositories), and stores the insights in a MySQL database.

It also features a premium glassmorphic dark-mode web dashboard to make it easy to trigger, view, delete, and browse profile analyses in real-time.

---

## Technical Stack
- **Core**: Node.js & Express.js
- **Database**: MySQL (using `mysql2/promise` with automatic database & table initialization)
- **Styling**: Modern Vanilla CSS (using Outfit and JetBrains Mono Google Fonts, gradients, flex/grid, and micro-animations)
- **Integration**: GitHub Public REST API (with pagination and rate-limit safety)

---

## Features
1. **GitHub Profile Scraper**: Pulls public user details (followers, bio, location, blog, etc.).
2. **Deep Repo Analytics**: Scans the user's public repositories (paginated up to 300 repositories) to:
   - Sum total stars across all repositories.
   - Aggregate primary language frequency and compute usage percentages.
   - Find the top 5 starred repositories with star/fork metrics.
3. **Database Caching & Version Control**: Stores insights locally. Re-submitting a profile updates the existing database record with fresh stats.
4. **Rich REST Endpoints**: API endpoints to analyze, fetch all, fetch single, and delete.
5. **Interactive Web Dashboard**: Beautiful, responsive client served directly on the root `/` URL.
6. **Programmatic Verifier**: Built-in test script to verify endpoint functionality.

---

## Project Structure
```
├── public/
│   ├── index.html        # Main Web UI dashboard
│   └── index.css         # Modern glassmorphism dark-theme styling
├── .env.example          # Sample environment variables config
├── .env                  # Real environment variables (git-ignored)
├── app.js                # Main Express server configuration & API routes
├── db.js                 # Database pool connection & auto-migration module
├── githubService.js      # GitHub REST API connection & analyzer module
├── schema.sql            # MySQL schema file for manual setup
├── package.json          # Node dependencies and scripts
└── README.md             # This guide
```

---

## Getting Started

### Prerequisites
1. **Node.js**: Ensure Node.js (v18+) is installed. (Check with `node -v`).
2. **MySQL Server**: Ensure MySQL Server is running locally or remotely (e.g., standard port `3306`).

### Installation
1. Clone or copy the project files to your directory.
2. In the project root, install dependencies:
   ```bash
   npm install
   ```

### Database & Environment Setup
1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your MySQL credentials:
   ```env
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=github_analyzer

   # Optional: GitHub token to increase API rate limit from 60 to 5000 requests/hr
   # GITHUB_TOKEN=your_personal_access_token
   ```
   > [!NOTE]
   > The application automatically creates the database `github_analyzer` and the table `profiles` on startup if they do not exist. You do not need to run SQL files manually!

---

## Running the Application

### Start Development Server
```bash
node app.js
```
On success, you will see:
```text
Database 'github_analyzer' and table 'profiles' are verified/initialized.

==================================================================
GitHub Profile Analyzer API is running at: http://localhost:3000
==================================================================
```

### Accessing the Web Dashboard
Open [http://localhost:3000](http://localhost:3000) in your web browser. You will be greeted by the dashboard, where you can type in any GitHub username to analyze it, click items in the sidebar to review cached entries, or delete them.

---

## API Endpoints

### 1. Analyze and Store/Update Profile
- **Endpoint**: `POST /api/profiles/:username`
- **Description**: Fetches the user profile and repository list from the GitHub API, calculates insights, inserts them into the database (or updates them if the user was already analyzed before), and returns the results.
- **Example request**: `POST http://localhost:3000/api/profiles/google`
- **Response Format (200 OK)**:
  ```json
  {
    "message": "Analysis completed and saved.",
    "profile": {
      "id": 1,
      "username": "google",
      "name": "Google",
      "avatar_url": "https://avatars.githubusercontent.com/u/1342004?v=4",
      "html_url": "https://github.com/google",
      "bio": "Google Open Source",
      "company": null,
      "blog": "https://opensource.google/",
      "location": "Mountain View, CA",
      "email": "opensource@google.com",
      "public_repos": 2600,
      "public_gists": 0,
      "followers": 32000,
      "following": 0,
      "github_created_at": "2012-01-18T00:30:17.000Z",
      "github_updated_at": "2026-06-15T18:22:10.000Z",
      "analyzed_at": "2026-06-20T10:00:00.000Z",
      "total_stars": 450125,
      "top_languages": [
        { "language": "C++", "count": 210 },
        { "language": "Go", "count": 190 }
      ],
      "top_repositories": [
        {
          "name": "material-design-icons",
          "description": "Material Design icons by Google",
          "html_url": "https://github.com/google/material-design-icons",
          "stars": 49000,
          "forks": 9300,
          "language": "HTML"
        }
      ]
    }
  }
  ```

### 2. Fetch Stored Analyses History
- **Endpoint**: `GET /api/profiles`
- **Description**: Retrieves a list of all profiles currently stored in the local database, ordered by the latest analysis timestamp first.
- **Example request**: `GET http://localhost:3000/api/profiles`

### 3. Fetch Single Profile Insights
- **Endpoint**: `GET /api/profiles/:username`
- **Description**: Retrieves the cached profile analysis and computed insights for a single username from the local database. If not analyzed yet, returns a `404` status with a instructions page link.
- **Example request**: `GET http://localhost:3000/api/profiles/google`

### 4. Delete Analysis Results
- **Endpoint**: `DELETE /api/profiles/:username`
- **Description**: Deletes the cached analysis and database records for the specified user.
- **Example request**: `DELETE http://localhost:3000/api/profiles/google`

---

## Verifying the API Programmatically
A separate verification script is included in this repository. To run the automated checks:
1. Ensure your `.env` contains valid credentials.
2. Run:
   ```bash
   node scratch/test_api.js
   ```
   *(Note: If testing before configuration, the verification script will start the server in SAFE MODE and output diagnostic database status before gracefully closing).*
