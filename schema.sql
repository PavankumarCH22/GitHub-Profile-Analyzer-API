-- GitHub Profile Analyzer Database Schema

CREATE DATABASE IF NOT EXISTS github_analyzer;
USE github_analyzer;

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
);
