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

// Start the server
console.log('🌐 Starting web server...');
require('./server.js');
