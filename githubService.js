// GitHub API integration and profile analysis service
require('dotenv').config();

const GITHUB_API_URL = 'https://api.github.com';

/**
 * Helper to build headers for GitHub API requests
 */
function getHeaders() {
  const headers = {
    'User-Agent': 'GitHub-Profile-Analyzer-API',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (process.env.GITHUB_TOKEN) {
    // Support both 'Bearer' and 'token' prefixes
    const token = process.env.GITHUB_TOKEN.trim();
    headers['Authorization'] = token.startsWith('token ') || token.startsWith('Bearer ')
      ? token
      : `Bearer ${token}`;
  }

  return headers;
}

/**
 * Fetches user profile data from GitHub API
 */
async function fetchUserProfile(username) {
  const url = `${GITHUB_API_URL}/users/${encodeURIComponent(username)}`;
  const response = await fetch(url, { headers: getHeaders() });

  if (response.status === 404) {
    const err = new Error(`GitHub user '${username}' not found.`);
    err.status = 404;
    throw err;
  }

  if (response.status === 403) {
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    if (rateLimitRemaining === '0') {
      const err = new Error('GitHub API rate limit exceeded. Please add a GITHUB_TOKEN in the .env file to increase limits.');
      err.status = 429;
      throw err;
    }
  }

  if (!response.ok) {
    const err = new Error(`GitHub API error: ${response.statusText}`);
    err.status = response.status;
    throw err;
  }

  return await response.json();
}

/**
 * Fetches all public repositories of a user (paginated, up to 300 repos)
 */
async function fetchUserRepos(username, publicReposCount) {
  const repos = [];
  const perPage = 100;
  // Calculate how many pages we need to fetch, cap at 3 pages (300 repos) to avoid rate limits
  const maxPages = Math.min(Math.ceil(publicReposCount / perPage), 3);

  for (let page = 1; page <= maxPages; page++) {
    const url = `${GITHUB_API_URL}/users/${encodeURIComponent(username)}/repos?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      // If we fail to fetch repos, log and break rather than failing the whole analysis
      console.warn(`Failed to fetch repos page ${page} for ${username}: ${response.statusText}`);
      break;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }
    repos.push(...data);
  }

  return repos;
}

/**
 * Performs analysis on the user's repositories to extract insights
 */
function analyzeRepositories(repos) {
  let totalStars = 0;
  const languageCounts = {};

  // 1. Calculate total stars and count primary languages
  repos.forEach(repo => {
    totalStars += repo.stargazers_count || 0;
    if (repo.language) {
      languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
    }
  });

  // 2. Sort and format top languages
  const topLanguages = Object.entries(languageCounts)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);

  // 3. Extract top repositories sorted by stars
  const topRepositories = repos
    .map(repo => ({
      name: repo.name,
      description: repo.description || 'No description provided.',
      html_url: repo.html_url,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      language: repo.language || 'Unknown'
    }))
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 5); // Take top 5 repos

  return {
    totalStars,
    topLanguages,
    topRepositories
  };
}

/**
 * Main service method: Fetches profile + repos, processes insights, and returns a unified object
 */
async function analyzeUserProfile(username) {
  // Fetch basic profile
  const profile = await fetchUserProfile(username);

  // Fetch and analyze repos if they have any public repos
  let totalStars = 0;
  let topLanguages = [];
  let topRepositories = [];

  if (profile.public_repos > 0) {
    try {
      const repos = await fetchUserRepos(username, profile.public_repos);
      const repoInsights = analyzeRepositories(repos);
      totalStars = repoInsights.totalStars;
      topLanguages = repoInsights.topLanguages;
      topRepositories = repoInsights.topRepositories;
    } catch (repoError) {
      console.error(`Error calculating repo insights for ${username}:`, repoError.message);
    }
  }

  return {
    username: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url,
    html_url: profile.html_url,
    bio: profile.bio,
    company: profile.company,
    blog: profile.blog,
    location: profile.location,
    email: profile.email,
    public_repos: profile.public_repos,
    public_gists: profile.public_gists,
    followers: profile.followers,
    following: profile.following,
    github_created_at: profile.created_at,
    github_updated_at: profile.updated_at,
    total_stars: totalStars,
    top_languages: topLanguages,
    top_repositories: topRepositories
  };
}

module.exports = {
  fetchUserProfile,
  fetchUserRepos,
  analyzeUserProfile
};
