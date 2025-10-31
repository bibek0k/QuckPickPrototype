/**
 * Firebase Configuration
 * Initialize Firebase services for React Native
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import messaging from '@react-native-firebase/messaging';

// Firebase is initialized automatically by React Native Firebase
// using google-services.json (Android) and GoogleService-Info.plist (iOS)

// Export Firebase services
export {
  auth,
  firestore,
  storage,
  messaging,
};

// Export convenience methods
export const getCurrentUser = () => auth().currentUser;

export const getFirestoreTimestamp = () => firestore.Timestamp.now();

export const getFirestoreFieldValue = () => firestore.FieldValue;
