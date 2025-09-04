import { NextResponse } from 'next/server';
import { initDatabase } from '../../../lib/database';

export async function GET() {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3000',
      services: {
        database: 'unknown',
        firebase: 'unknown'
      }
    };

    // Check database connectivity (non-blocking)
    try {
      const db = initDatabase('regular');
      if (db) {
        // Simple query to test database
        db.prepare('SELECT 1 as test').get();
        healthCheck.services.database = 'healthy';
      } else {
        healthCheck.services.database = 'unavailable';
      }
    } catch (dbError) {
      console.warn('Database health check failed:', dbError);
      healthCheck.services.database = 'unhealthy';
    }

    // Check Firebase connectivity (non-blocking)
    try {
      // Basic Firebase check - just verify environment variables exist
      const hasFirebaseConfig = !!(
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
        process.env.VIRTUAL_FIREBASE_API_KEY
      );
      healthCheck.services.firebase = hasFirebaseConfig ? 'configured' : 'not_configured';
    } catch (firebaseError) {
      console.warn('Firebase health check failed:', firebaseError);
      healthCheck.services.firebase = 'unhealthy';
    }

    // Determine overall health status
    const isHealthy = healthCheck.services.database !== 'unhealthy' && 
                     healthCheck.services.firebase !== 'unhealthy';

    return NextResponse.json(healthCheck, { 
      status: isHealthy ? 200 : 503 
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
