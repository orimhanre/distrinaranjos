import { NextResponse } from 'next/server';
import { fetchCollection } from '../../../lib/firestoreUtils';

function getMonday(d: Date) {
  d = new Date(d);
  const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Add a type for visits
interface Visit {
  id: string;
  timestamp?: any;
}

export async function GET() {
  // Handle build-time page data collection
  const hasRegularFirebase = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                               process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                               process.env.FIREBASE_PRIVATE_KEY &&
                               process.env.FIREBASE_CLIENT_EMAIL);
  
  const hasVirtualFirebase = !!(process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY && 
                               process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID &&
                               process.env.VIRTUAL_FIREBASE_PRIVATE_KEY &&
                               process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL);
  
  if (!hasRegularFirebase && !hasVirtualFirebase) {
    console.log('⚠️ Neither regular nor virtual Firebase environment variables available, skipping operation');
    return NextResponse.json({ 
      success: false, 
      error: 'Firebase not configured for either environment',
      week: 0, month: 0, year: 0
    }, { status: 503 });
  }

  try {
    const visits: Visit[] = await fetchCollection('visits');
    const now = new Date();

    // Week: Monday to Sunday
    const monday = getMonday(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Month: 1st to 31st
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Year: Jan 1 to Dec 31
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    function inRange(ts: any, start: Date, end: Date) {
      if (!ts) return false;
      const t = ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    }

    const week = visits.filter(v => inRange(v.timestamp, monday, sunday)).length;
    const month = visits.filter(v => inRange(v.timestamp, monthStart, monthEnd)).length;
    const year = visits.filter(v => inRange(v.timestamp, yearStart, yearEnd)).length;

    return NextResponse.json({ week, month, year });
  } catch (error) {
    console.error('Error fetching visitor stats:', error);
    return NextResponse.json({ week: 0, month: 0, year: 0 });
  }
} 