import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
    // Check if required environment variables are available for both regular and virtual environments
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
        error: 'Firebase not configured for either environment' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db, virtualDb } = await import('../../../../lib/firebase');
  try {
    const { userEmail, userName, userPhotoURL, profileData: checkoutProfileData } = await request.json();

    if (!userEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('🔍 Create Profile API: Creating profile for:', userEmail);
    console.log('🔍 Create Profile API: Using database:', virtualDb ? 'virtual' : 'main (fallback)');

    // Check if profile already exists in virtual database
    const existingProfile = await getDoc(doc(virtualDb || db, 'clients', userEmail));
    
    if (existingProfile.exists()) {
      // Update profile with checkout data if provided
      const updateData: any = {
        lastLogin: new Date()
      };
      
      if (checkoutProfileData) {
        // Update with Spanish field names for profile page compatibility
        updateData.nombre = checkoutProfileData.firstName || existingProfile.data().nombre || existingProfile.data().firstName;
        updateData.apellido = checkoutProfileData.lastName || existingProfile.data().apellido || existingProfile.data().lastName;
        updateData.celular = checkoutProfileData.phone || existingProfile.data().celular || existingProfile.data().phone;
        updateData.cedula = checkoutProfileData.cedula || existingProfile.data().cedula;
        updateData.direccion = checkoutProfileData.address || existingProfile.data().direccion || existingProfile.data().address;
        updateData.ciudad = checkoutProfileData.city || existingProfile.data().ciudad || existingProfile.data().city;
        updateData.departamento = checkoutProfileData.department || existingProfile.data().departamento || existingProfile.data().department;
        updateData.codigoPostal = checkoutProfileData.postalCode || existingProfile.data().codigoPostal || existingProfile.data().postalCode;
        // Keep English fields for backward compatibility
        updateData.firstName = checkoutProfileData.firstName || existingProfile.data().firstName;
        updateData.lastName = checkoutProfileData.lastName || existingProfile.data().lastName;
        updateData.phone = checkoutProfileData.phone || existingProfile.data().phone;
        updateData.address = checkoutProfileData.address || existingProfile.data().address;
        updateData.city = checkoutProfileData.city || existingProfile.data().city;
        updateData.department = checkoutProfileData.department || existingProfile.data().department;
        updateData.postalCode = checkoutProfileData.postalCode || existingProfile.data().postalCode;
        updateData.lastUpdated = new Date();
      }
      
      await updateDoc(doc(virtualDb || db, 'clients', userEmail), updateData);
      
      return NextResponse.json({ 
        success: true, 
        message: checkoutProfileData ? 'Profile updated with checkout data' : 'Profile already exists, last login updated',
        profile: { ...existingProfile.data(), ...updateData }
      });
    }

    // Create new client profile with Spanish field structure to match profile page expectations
    const profileData = {
      correo: userEmail,
      nombre: checkoutProfileData?.firstName || userName?.split(' ')[0] || '',
      apellido: checkoutProfileData?.lastName || userName?.split(' ').slice(1).join(' ') || '',
      celular: checkoutProfileData?.phone || '',
      cedula: checkoutProfileData?.cedula || '',
      direccion: checkoutProfileData?.address || '',
      ciudad: checkoutProfileData?.city || '',
      departamento: checkoutProfileData?.department || '',
      codigoPostal: checkoutProfileData?.postalCode || '',
      // Keep English fields for backward compatibility
      email: userEmail,
      firstName: checkoutProfileData?.firstName || userName?.split(' ')[0] || '',
      lastName: checkoutProfileData?.lastName || userName?.split(' ').slice(1).join(' ') || '',
      phone: checkoutProfileData?.phone || '',
      address: checkoutProfileData?.address || '',
      city: checkoutProfileData?.city || '',
      department: checkoutProfileData?.department || '',
      postalCode: checkoutProfileData?.postalCode || '',
      googleId: userEmail, // Using email as identifier
      createdAt: new Date(),
      lastLogin: new Date(),
      profilePicture: userPhotoURL || null,
      lastUpdated: checkoutProfileData?.lastUpdated || new Date()
    };

    await setDoc(doc(virtualDb || db, 'clients', userEmail), profileData);

    // Link existing orders to this client (using virtual database and virtualOrders collection)
    const ordersQuery = query(
      collection(virtualDb || db, 'virtualOrders'),
      where('client.email', '==', userEmail)
    );

    const ordersSnapshot = await getDocs(ordersQuery);
    let linkedOrders = 0;

    // Update orders to mark them as linked to client account
    for (const orderDoc of ordersSnapshot.docs) {
      await updateDoc(doc(virtualDb || db, 'virtualOrders', orderDoc.id), {
        clientAccountLinked: true,
        clientAccountLinkedAt: new Date()
      });
      linkedOrders++;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Client profile created successfully',
      profile: profileData,
      linkedOrders
    });

  } catch (error) {
    console.error('Error creating client profile:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
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
  
  return NextResponse.json({ 
    success: true, 
    message: 'API endpoint available',
    configured: hasRegularFirebase || hasVirtualFirebase,
    regularFirebase: hasRegularFirebase,
    virtualFirebase: hasVirtualFirebase
  });
}