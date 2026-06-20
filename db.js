// Database connection pool and initialization module
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

/**
 * Returns the MySQL connection pool
 */
async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'github_analyzer',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

/**
 * Ensures the database and required tables exist
 */
async function initializeDatabase() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'github_analyzer';

  let tempConnection;
  try {
    // 1. Connect to MySQL server without database selected to verify credentials
    tempConnection = await mysql.createConnection({
      host,
      port,
      user,
      password
    });
  } catch (error) {
    console.error('\n==================================================================');
    console.error('DATABASE CONNECTION ERROR: Failed to connect to MySQL server!');
    console.error(`Host: ${host}:${port}, User: ${user}`);
    console.error(`Error details: ${error.message}`);
    console.error('\nACTION REQUIRED: Please check if MySQL is running and set the correct');
    console.error('database password in your .env file.');
    console.error('==================================================================\n');
    throw error;
  }

  try {
    // 2. Create the database if it doesn't exist
    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await tempConnection.end();
  } catch (error) {
    if (tempConnection) await tempConnection.end();
    console.error(`Failed to create database '${dbName}': ${error.message}`);
    throw error;
  }

  // 3. Initialize the connection pool (now that the database is guaranteed to exist)
  const connectionPool = await getPool();

  // 4. Create the profiles table if it doesn't exist
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(150),
      avatar_url VARCHAR(255),
      html_url VARCHAR(255),
      bio TEXT,
      company VARCHAR(150),
      blog VARCHAR(255),
      location VARCHAR(150),
      email VARCHAR(150),
      public_repos INT DEFAULT 0,
      public_gists INT DEFAULT 0,
      followers INT DEFAULT 0,
      following INT DEFAULT 0,
      github_created_at DATETIME,
      github_updated_at DATETIME,
      analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      total_stars INT DEFAULT 0,
      top_languages JSON,
      top_repositories JSON
    )
  `;

  try {
    await connectionPool.query(createTableQuery);
    console.log(`Database '${dbName}' and table 'profiles' are verified/initialized.`);
  } catch (error) {
    console.error(`Failed to initialize 'profiles' table: ${error.message}`);
    throw error;
  }
}

/**
 * Execute a SQL query helper
 */
async function query(sql, params) {
  const connectionPool = await getPool();
  const [results] = await connectionPool.execute(sql, params);
  return results;
}

module.exports = {
  initializeDatabase,
  query,
  getPool
};
