#!/usr/bin/env node

// Startup script to handle graceful initialization
console.log('🚀 Starting QuickOrder Web Application...');

// Set up error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit in production to allow Railway to handle restarts
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Initialize database gracefully
try {
  console.log('📊 Initializing database...');
  const { initDatabase } = require('./lib/database');
  
  // Try to initialize both databases
  const regularDb = initDatabase('regular');
  const virtualDb = initDatabase('virtual');
  
  if (regularDb) {
    console.log('✅ Regular database initialized');
  } else {
    console.log('⚠️ Regular database not available');
  }
  
  if (virtualDb) {
    console.log('✅ Virtual database initialized');
  } else {
    console.log('⚠️ Virtual database not available');
  }
} catch (error) {
  console.warn('⚠️ Database initialization failed:', error.message);
  console.log('🔄 Continuing without database...');
}

// Auto-restore from backup if explicitly enabled (async, non-blocking)
setTimeout(() => {
  try {
    if (process.env.ENABLE_AUTO_RESTORE === 'true') {
      const { autoRestore } = require('./scripts/backup-restore');
      console.log('🔄 ENABLE_AUTO_RESTORE=true → running autoRestore');
      autoRestore();
    } else {
      console.log('⏭️ Skipping autoRestore (ENABLE_AUTO_RESTORE not true)');
    }
  } catch (e) {
    console.warn('⚠️ autoRestore startup guard error:', e?.message || e);
  }
}, 5000); // Wait 5 seconds for server to be ready

// Auto-sync empty databases (async, non-blocking)
setTimeout(async () => {
  try {
    console.log('🔄 Running auto-sync check for empty databases...');
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/database/auto-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Auto-sync completed:', result.message);
    } else {
      console.log('⚠️ Auto-sync failed:', response.status, response.statusText);
    }
  } catch (e) {
    console.warn('⚠️ autoSync startup guard error:', e?.message || e);
  }
}, 10000); // Wait 10 seconds for server to be ready

// Start the server
console.log('🌐 Starting web server...');
require('./server.js');
