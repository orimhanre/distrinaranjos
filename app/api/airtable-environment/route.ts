import { NextRequest, NextResponse } from 'next/server';
import { AirtableService } from '@/lib/airtable';

export async function POST(request: NextRequest) {
  try {
    const { environment } = await request.json();
    
    if (environment !== 'virtual' && environment !== 'regular') {
      return NextResponse.json({
        success: false,
        message: 'Invalid environment. Must be "virtual" or "regular"'
      }, { status: 400 });
    }
    
    // Switch environment
    AirtableService.switchEnvironment(environment);
    
    // Test the connection with the new environment
    const isConnected = await AirtableService.testConnection();
    
    return NextResponse.json({
      success: true,
      message: `Switched to ${environment} environment`,
      environment,
      connected: isConnected
    });
  } catch (error) {
    console.error('Error switching Airtable environment:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to switch environment'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const currentEnvironment = AirtableService.getCurrentEnvironment();
    const isConnected = await AirtableService.testConnection();
    
    return NextResponse.json({
      success: true,
      environment: currentEnvironment,
      connected: isConnected
    });
  } catch (error) {
    console.error('Error getting Airtable environment status:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get environment status'
    }, { status: 500 });
  }
} 