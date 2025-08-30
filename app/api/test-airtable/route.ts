import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_AIRTABLE_API_KEY;
    const baseId = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
    const accountEmail = process.env.AIRTABLE_ACCOUNT_EMAIL;
    
    console.log('🔍 Testing Airtable connection with:');
    console.log('API Key exists:', !!apiKey);
    console.log('Base ID:', baseId);
    console.log('Account Email:', accountEmail);
    
    if (!apiKey || !baseId) {
      return NextResponse.json({
        success: false,
        error: 'Missing API key or Base ID',
        apiKeyExists: !!apiKey,
        baseIdExists: !!baseId
      });
    }
    
    // Test basic connection
    const base = new Airtable({ apiKey }).base(baseId);
    
    // Try to access the default "Products" table
    try {
      const table = base('Products');
      const records = await table.select({ maxRecords: 1 }).firstPage();
      
      return NextResponse.json({
        success: true,
        message: 'Airtable connection successful (Products table)',
        recordCount: records.length,
        apiKeyExists: !!apiKey,
        baseId: baseId
      });
    } catch (productError) {
      console.error('❌ Error accessing Products table:', productError);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to access Products table',
        productError: productError instanceof Error ? productError.message : 'Unknown error',
        apiKeyExists: !!apiKey,
        baseId: baseId
      });
    }
    
  } catch (error) {
    console.error('❌ Airtable test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Airtable connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
