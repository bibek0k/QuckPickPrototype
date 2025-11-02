import React, { useState, useEffect } from 'react';
import { signInWithPhoneNumber, signOut } from 'firebase/auth';
import { auth } from './firebase';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [processing, setProcessing] = useState({});
  const [error, setError] = useState('');

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      setUser(authUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch pending drivers when user is authenticated
  useEffect(() => {
    if (user) {
      fetchPendingDrivers();
    }
  }, [user]);

  const fetchPendingDrivers = async () => {
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/drivers/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending drivers');
      }

      const data = await response.json();
      setPendingDrivers(data.drivers || []);
    } catch (err) {
      console.error('Error fetching pending drivers:', err);
      setError('Failed to load pending drivers');
    }
  };

  const handleApprove = async (driverId) => {
    setProcessing({ ...processing, [driverId]: true });
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/drivers/${driverId}/verify`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve driver');
      }

      // Remove driver from pending list
      setPendingDrivers(pendingDrivers.filter(driver => driver.id !== driverId));
    } catch (err) {
      console.error('Error approving driver:', err);
      setError('Failed to approve driver');
    } finally {
      setProcessing({ ...processing, [driverId]: false });
    }
  };

  const handleReject = async (driverId) => {
    const reason = prompt('Please provide rejection reason:');
    if (!reason) return;

    setProcessing({ ...processing, [driverId]: true });
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/drivers/${driverId}/verify`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: reason
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject driver');
      }

      // Remove driver from pending list
      setPendingDrivers(pendingDrivers.filter(driver => driver.id !== driverId));
    } catch (err) {
      console.error('Error rejecting driver:', err);
      setError('Failed to reject driver');
    } finally {
      setProcessing({ ...processing, [driverId]: false });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setPendingDrivers([]);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto h-12 w-12 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">QP</span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Admin Dashboard
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Quick Pickup Admin Portal
            </p>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-center text-gray-600 mb-4">
              Please use Firebase Authentication to sign in with admin credentials.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This is a simplified login interface. In production,
                integrate proper Firebase Auth UI or implement phone/email authentication.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-orange-500 shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center mr-3">
                <span className="text-orange-500 font-bold text-sm">QP</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Quick Pickup Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-white">{user.email || user.phoneNumber}</span>
              <button
                onClick={handleSignOut}
                className="bg-white text-orange-500 px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <div className="flex">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-700 hover:text-red-900"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Pending Drivers</dt>
                    <dd className="text-lg font-medium text-gray-900">{pendingDrivers.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
                    <dd className="text-lg font-medium text-gray-900">Operational</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Rides</dt>
                    <dd className="text-lg font-medium text-gray-900">-</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Drivers Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Pending Driver Verifications
            </h3>

            {pendingDrivers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No pending drivers</h3>
                <p className="mt-1 text-sm text-gray-500">All driver verifications are up to date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vehicle
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
                    {pendingDrivers.map((driver) => (
                      <tr key={driver.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{driver.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{driver.phoneNumber}</div>
                          {driver.email && <div className="text-sm text-gray-500">{driver.email}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {driver.vehicleInfo?.make} {driver.vehicleInfo?.model}
                          </div>
                          <div className="text-sm text-gray-500">
                            {driver.vehicleInfo?.type} • {driver.vehicleInfo?.licensePlate}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {driver.submittedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleApprove(driver.id)}
                              disabled={processing[driver.id]}
                              className="bg-green-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {processing[driver.id] ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReject(driver.id)}
                              disabled={processing[driver.id]}
                              className="bg-red-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {processing[driver.id] ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;