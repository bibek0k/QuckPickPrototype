/**
 * Authentication Context
 * Manages user authentication state and provides auth functions
 */

import React, {createContext, useState, useEffect, useContext} from 'react';
import {auth, firestore} from '../config/firebase';
import api from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export const AuthProvider = ({children}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = auth().onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        // Get user data from Firestore
        try {
          const userDoc = await firestore()
            .collection('users')
            .doc(firebaseUser.uid)
            .get();

          if (userDoc.exists) {
            const userData = {
              uid: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber,
              ...userDoc.data(),
            };
            setUser(userData);
            await AsyncStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUser(null);
        await AsyncStorage.removeItem('user');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Send OTP to phone number
   */
  const sendOTP = async (phoneNumber) => {
    try {
      const response = await api.post('/auth/send-otp', {phoneNumber});
      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Verify OTP and sign in
   */
  const verifyOTP = async (phoneNumber, otp) => {
    try {
      const response = await api.post('/auth/verify-otp', {phoneNumber, otp});

      // Sign in with custom token
      await auth().signInWithCustomToken(response.token);

      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      await auth().signOut();
      setUser(null);
      await AsyncStorage.removeItem('user');
    } catch (error) {
      throw error;
    }
  };

  /**
   * Update user profile
   */
  const updateProfile = async (updates) => {
    try {
      const response = await api.put('/auth/profile', updates);

      // Update local user state
      const updatedUser = {...user, ...updates};
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

      return response;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Verify user age (18+)
   */
  const verifyAge = async () => {
    try {
      await api.post('/auth/verify-age', {confirmed: true});

      // Update local user state
      const updatedUser = {...user, ageVerified: true};
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      throw error;
    }
  };

  /**
   * Refresh user data from Firestore
   */
  const refreshUser = async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await firestore()
        .collection('users')
        .doc(user.uid)
        .get();

      if (userDoc.exists) {
        const userData = {
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          ...userDoc.data(),
        };
        setUser(userData);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const value = {
    user,
    loading,
    sendOTP,
    verifyOTP,
    signOut,
    updateProfile,
    verifyAge,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
