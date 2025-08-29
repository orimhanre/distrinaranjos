import { NextResponse } from 'next/server';
import { virtualAdminAuth } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    console.log('=== CHECKING VIRTUAL FIREBASE AUTH USERS ===');
    
    if (!virtualAdminAuth) {
      console.log('Virtual Firebase Admin Auth not available');
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual Firebase Admin Auth not available',
        virtualAdminAuth: false
      });
    }

    console.log('Virtual Firebase Admin Auth is available');
    
    // List all users in the virtual Firebase project
    try {
      const listUsersResult = await virtualAdminAuth.listUsers();
      console.log('Successfully listed virtual users:', listUsersResult.users.length);
      
      const users = listUsersResult.users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime
        },
        providerData: user.providerData.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
          displayName: provider.displayName
        }))
      }));
      
      return NextResponse.json({ 
        success: true, 
        message: 'Virtual Firebase Auth users retrieved successfully',
        userCount: listUsersResult.users.length,
        users: users,
        virtualAdminAuth: true
      });
    } catch (listError: any) {
      console.error('Error listing virtual users:', listError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error listing virtual Firebase Auth users',
        listError: listError.message,
        virtualAdminAuth: true
      });
    }
    
  } catch (error: any) {
    console.error('Error in virtual auth users endpoint:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error checking virtual Firebase Auth users',
      errorMessage: error.message
    });
  }
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!virtualAdminAuth) {
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual Firebase Admin Auth not available'
      });
    }

    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email is required'
      });
    }

    // Check if user exists in virtual Firebase Auth
    try {
      const userRecord = await virtualAdminAuth.getUserByEmail(email);
      console.log('User found in virtual Firebase Auth:', userRecord.email);
      
      return NextResponse.json({ 
        success: true, 
        message: 'User found in virtual Firebase Auth',
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName,
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled,
          metadata: {
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime
          }
        }
      });
    } catch (userError: any) {
      if (userError.code === 'auth/user-not-found') {
        return NextResponse.json({ 
          success: false, 
          message: 'User not found in virtual Firebase Auth',
          userExists: false
        });
      }
      throw userError;
    }
    
  } catch (error: any) {
    console.error('Error checking virtual user:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error checking virtual Firebase Auth user',
      errorMessage: error.message
    });
  }
} 