import React, { useState, useEffect } from 'react';
import { auth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import axios from 'axios';

// Firebase configuration - should match the mobile app config
const firebaseConfig = {
  apiKey: "AIzaSyDemoKeyForQuickPickupApp",
  authDomain: "quick-pickup-demo.firebaseapp.com",
  projectId: "quick-pickup-demo",
  storageBucket: "quick-pickup-demo.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789012345678"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Simple toast notification component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-between min-w-[300px]`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-white hover:text-gray-200">×</button>
    </div>
  );
};

// Login component
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
      const authInstance = getAuth(app);

      const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
      const user = userCredential.user;

      // Get user data from Firestore to check role
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore(app);
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        await authInstance.signOut();
        setError('Access denied. Admin privileges required.');
        return;
      }

      onLogin({ ...user, role: userDoc.data().role });
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Quick Pickup Admin</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Rejection modal component
const RejectionModal = ({ driver, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(driver.id, reason);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Reject Driver Application</h3>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            <strong>Driver:</strong> {driver.name}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            <strong>Phone:</strong> {driver.phoneNumber}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rejection Reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Please provide a reason for rejection..."
            required
          />

          <div className="flex justify-end space-x-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Reject Driver
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main admin dashboard
const AdminDashboard = ({ user, onLogout }) => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  const fetchPendingDrivers = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();

      const response = await axios.get(`${API_BASE_URL}/admin/drivers/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setDrivers(response.data.drivers || []);
      setError('');
    } catch (error) {
      console.error('Error fetching drivers:', error);
      if (error.response?.status === 401) {
        setError('Session expired. Please login again.');
        onLogout();
      } else if (error.response?.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else {
        setError('Failed to load drivers. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingDrivers();
  }, [user]);

  const handleApprove = async (driverId) => {
    try {
      const token = await user.getIdToken();

      await axios.put(`${API_BASE_URL}/admin/drivers/${driverId}/verify`,
        { status: 'approved' },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Remove driver from list
      setDrivers(drivers.filter(d => d.id !== driverId));
      showToast('Driver approved successfully!');
    } catch (error) {
      console.error('Error approving driver:', error);
      showToast('Failed to approve driver. Please try again.', 'error');
    }
  };

  const handleReject = async (driverId, rejectionReason) => {
    try {
      const token = await user.getIdToken();

      await axios.put(`${API_BASE_URL}/admin/drivers/${driverId}/verify`,
        { status: 'rejected', rejectionReason },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Remove driver from list
      setDrivers(drivers.filter(d => d.id !== driverId));
      setShowRejectionModal(false);
      setSelectedDriver(null);
      showToast('Driver rejected successfully!');
    } catch (error) {
      console.error('Error rejecting driver:', error);
      showToast('Failed to reject driver. Please try again.', 'error');
    }
  };

  const openRejectionModal = (driver) => {
    setSelectedDriver(driver);
    setShowRejectionModal(true);
  };

  const closeRejectionModal = () => {
    setShowRejectionModal(false);
    setSelectedDriver(null);
  };

  const handleLogout = async () => {
    try {
      const { getAuth } = await import('firebase/auth');
      const authInstance = getAuth(app);
      await authInstance.signOut();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quick Pickup Admin</h1>
              <p className="text-sm text-gray-600">Driver Verification Dashboard</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Pending Drivers</h3>
            <p className="text-2xl font-bold text-yellow-600">{drivers.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Applications</h3>
            <p className="text-2xl font-bold text-blue-600">{drivers.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="text-lg font-semibold text-green-600">System Active</p>
          </div>
        </div>

        {/* Drivers Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Pending Driver Verifications</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading drivers...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={fetchPendingDrivers}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : drivers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No pending driver verifications at this time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver Information
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {drivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                          <div className="text-sm text-gray-500">{driver.phoneNumber}</div>
                          {driver.email && (
                            <div className="text-xs text-gray-400">{driver.email}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {driver.vehicleInfo?.type ? driver.vehicleInfo.type.charAt(0).toUpperCase() + driver.vehicleInfo.type.slice(1) : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {driver.vehicleInfo?.make} {driver.vehicleInfo?.model}
                        </div>
                        <div className="text-xs text-gray-400">
                          {driver.vehicleInfo?.color} • {driver.vehicleInfo?.licensePlate}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(driver.submittedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleApprove(driver.id)}
                          className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-md mr-2"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openRejectionModal(driver)}
                          className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-md"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Rejection Modal */}
      {showRejectionModal && selectedDriver && (
        <RejectionModal
          driver={selectedDriver}
          onClose={closeRejectionModal}
          onConfirm={handleReject}
        />
      )}
    </div>
  );
};

// Main App component
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { getAuth, onAuthStateChanged } = await import('firebase/auth');
        const authInstance = getAuth(app);

        onAuthStateChanged(authInstance, async (firebaseUser) => {
          if (firebaseUser) {
            // Get user data from Firestore to check role
            try {
              const { getFirestore, doc, getDoc } = await import('firebase/firestore');
              const db = getFirestore(app);
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

              if (userDoc.exists() && userDoc.data().role === 'admin') {
                setUser({ ...firebaseUser, role: userDoc.data().role });
              } else {
                // User exists but not admin, sign them out
                await authInstance.signOut();
              }
            } catch (error) {
              console.error('Error checking user role:', error);
              await authInstance.signOut();
            }
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        <AdminDashboard user={user} onLogout={() => setUser(null)} />
      )}
    </div>
  );
}

export default App;