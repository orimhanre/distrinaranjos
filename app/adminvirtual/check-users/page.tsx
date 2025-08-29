"use client";
import { useEffect, useState } from "react";
import { virtualAuth, virtualGoogleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { checkVirtualAdminPermission } from "@/lib/adminPermissions";

export default function CheckVirtualUsersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [virtualUsers, setVirtualUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [userCheckResult, setUserCheckResult] = useState<any>(null);

  useEffect(() => {
    if (!virtualAuth) {
      console.error('Virtual auth not available');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(virtualAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email) {
      setPermissionLoading(true);
      checkVirtualAdminPermission(user.email).then((result) => {
        setHasPermission(result);
        setPermissionLoading(false);
      });
    } else {
      setHasPermission(false);
      setPermissionLoading(false);
    }
  }, [user]);

  const handleLogin = async () => {
    if (!virtualAuth || !virtualGoogleProvider) {
      alert('Virtual auth not available');
      return;
    }
    try {
      await signInWithPopup(virtualAuth, virtualGoogleProvider);
    } catch (error: any) {
      alert(`Login failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    if (!virtualAuth) {
      alert('Virtual auth not available');
      return;
    }
    await signOut(virtualAuth);
  };

  const fetchVirtualUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/admin/virtual-auth-users');
      const data = await response.json();
      if (data.success) {
        setVirtualUsers(data.users);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to fetch virtual users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const checkUserInVirtualAuth = async () => {
    if (!testEmail.trim()) {
      alert('Please enter an email');
      return;
    }

    try {
      const response = await fetch('/api/admin/virtual-auth-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail.trim() })
      });
      
      const data = await response.json();
      setUserCheckResult(data);
    } catch (error) {
      setUserCheckResult({ success: false, error: 'Failed to check user' });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4 text-black">Inicio de Sesión de Administrador Virtual</h1>
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold"
        >
          Iniciar sesión con Google
        </button>
      </div>
    );
  }

  if (permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-black">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold mb-4 text-black">Acceso denegado</h1>
        <p className="mb-4 text-black">Tu cuenta no está autorizada para ver esta página.</p>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-black">Virtual Firebase Authentication Users Check</h1>
        
        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-black">Current User</h2>
          <p className="text-black"><strong>Signed in as:</strong> {user.email}</p>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mt-2"
          >
            Sign Out
          </button>
        </div>

        {/* Fetch Virtual Users */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-black">Virtual Firebase Auth Users</h2>
          <button
            onClick={fetchVirtualUsers}
            disabled={loadingUsers}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-4 disabled:opacity-50"
          >
            {loadingUsers ? 'Loading...' : 'Fetch Virtual Users'}
          </button>
          
          {virtualUsers.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2 text-black">Found {virtualUsers.length} users:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {virtualUsers.map((user, index) => (
                  <div key={index} className="border border-gray-200 p-3 rounded bg-gray-50">
                    <p className="text-black"><strong>Email:</strong> {user.email}</p>
                    <p className="text-black"><strong>UID:</strong> {user.uid}</p>
                    <p className="text-black"><strong>Created:</strong> {user.metadata.creationTime}</p>
                    <p className="text-black"><strong>Last Sign In:</strong> {user.metadata.lastSignInTime}</p>
                    <p className="text-black"><strong>Email Verified:</strong> {user.emailVerified ? 'Yes' : 'No'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Check Specific User */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-black">Check Specific User</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter email to check"
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-black"
            />
            <button
              onClick={checkUserInVirtualAuth}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Check User
            </button>
          </div>
          
          {userCheckResult && (
            <div className="mt-4 p-4 border rounded">
              <h3 className="font-semibold mb-2 text-black">Result:</h3>
              <pre className="text-sm overflow-auto text-black">
                {JSON.stringify(userCheckResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-black">What This Means</h2>
          <div className="space-y-2 text-black">
            <p><strong>If users appear in the list above:</strong> They are properly registered in virtual Firebase Auth</p>
            <p><strong>If users don't appear:</strong> They haven't signed in to the virtual system yet</p>
            <p><strong>Expected behavior:</strong> Users should appear here after they sign in with Google on the virtual admin pages</p>
            <p><strong>Note:</strong> This is different from the main admin system which uses a different Firebase project</p>
          </div>
        </div>
      </div>
    </div>
  );
} 