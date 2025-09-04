import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail is required' },
        { status: 400 }
      );
    }

    const db = initDatabase('virtual');
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 }
      );
    }
    
    // Clear badge count for the user
    const stmt = db.prepare('UPDATE badge_counts SET badge_count = 0, last_updated = CURRENT_TIMESTAMP WHERE user_email = ?');
    const result = stmt.run(userEmail);
    
    if (result.changes > 0) {
      console.log(`✅ Badge count cleared for user: ${userEmail}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Badge count cleared',
        userEmail 
      });
    } else {
      // If user doesn't exist in badge_counts, create them with 0 count
      const insertStmt = db.prepare('INSERT OR IGNORE INTO badge_counts (user_email, badge_count, last_updated) VALUES (?, 0, CURRENT_TIMESTAMP)');
      insertStmt.run(userEmail);
      console.log(`✅ Badge count initialized to 0 for user: ${userEmail}`);
      return NextResponse.json({ 
        success: true, 
        message: 'Badge count initialized',
        userEmail 
      });
    }
    
  } catch (error) {
    console.error('❌ Error clearing badge count:', error);
    return NextResponse.json(
      { error: 'Failed to clear badge count' },
      { status: 500 }
    );
  }
}
