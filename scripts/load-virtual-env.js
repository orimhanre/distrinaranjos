#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load virtual environment variables
function loadVirtualEnv() {
  const virtualEnvPath = path.resolve(process.cwd(), '.env.virtual.local');
  
  if (!fs.existsSync(virtualEnvPath)) {
    console.log('⚠️  .env.virtual.local not found, using default environment');
    return;
  }

  const content = fs.readFileSync(virtualEnvPath, 'utf8');
  const envVars = {};

  content.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex);
        const value = trimmedLine.substring(equalIndex + 1);
        envVars[key] = value;
      }
    }
  });

  // Set environment variables
  Object.keys(envVars).forEach(key => {
    process.env[key] = envVars[key];
  });

  console.log('✅ Loaded virtual environment variables:', Object.keys(envVars).length, 'variables');
}

// Load virtual environment when this script is run
if (require.main === module) {
  loadVirtualEnv();
}

module.exports = { loadVirtualEnv };
