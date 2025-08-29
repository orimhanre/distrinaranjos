import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';

export async function GET() {
  try {
    const db = initDatabase('virtual');
    
    // Get all badge counts
    const stmt = db.prepare('SELECT user_email, badge_count, last_updated FROM badge_counts ORDER BY last_updated DESC');
    const results = stmt.all() as { user_email: string; badge_count: number; last_updated: string }[];
    
    return NextResponse.json({
      success: true,
      badgeCounts: results,
      totalUsers: results.length,
      totalBadges: results.reduce((sum, user) => sum + user.badge_count, 0)
    });
    
  } catch (error) {
    console.error('❌ Error getting badge counts:', error);
    return NextResponse.json(
      { error: 'Failed to get badge counts' },
      { status: 500 }
    );
  }
}
