/**
 * Driver Home Screen
 * Main driver interface with online/offline toggle and map view
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Linking,
  ScrollView,
  RefreshControl
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';

const DriverHomeScreen = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [isFetchingJobs, setIsFetchingJobs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jobFetchInterval, setJobFetchInterval] = useState(null);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Request location permission
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Access Required',
            message: 'Quick Pickup needs access to your location to show you on the map',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Location permission error:', err);
        return false;
      }
    }
    return true; // iOS permissions are handled automatically
  };

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setLocationLoading(false);
        Alert.alert(
          'Location Permission Required',
          'Please enable location permission to use driver mode. Go to Settings and enable location access.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { latitude, longitude };
          setCurrentLocation(newLocation);
          setRegion({
            latitude,
            longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          });
          setLocationLoading(false);
        },
        (error) => {
          console.error('Location error:', error);
          setLocationLoading(false);
          Alert.alert(
            'Location Error',
            'Unable to get your current location. Please check your GPS settings.',
            [{ text: 'OK' }]
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    } catch (error) {
      console.error('Get location error:', error);
      setLocationLoading(false);
    }
  }, []);

  // Watch position updates
  useEffect(() => {
    getCurrentLocation();

    let watchId;
    const startWatching = async () => {
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        watchId = Geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setCurrentLocation({ latitude, longitude });
            setRegion(prev => ({
              ...prev,
              latitude,
              longitude,
            }));
          },
          (error) => console.error('Watch position error:', error),
          {
            enableHighAccuracy: true,
            distanceFilter: 100, // Update every 100 meters
            interval: 5000, // Update every 5 seconds
          }
        );
      }
    };

    startWatching();

    return () => {
      if (watchId) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [getCurrentLocation]);

  // Continuous location updates when online
  useEffect(() => {
    let locationUpdateInterval;

    if (isOnline && currentLocation) {
      // Send location updates every 10 seconds
      locationUpdateInterval = setInterval(async () => {
        try {
          await api.put('/drivers/location', {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
          });
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }, 10000);
    }

    return () => {
      if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
      }
    };
  }, [isOnline, currentLocation]);

  // Fetch pending jobs when online
  useEffect(() => {
    if (isOnline && currentLocation) {
      // Fetch jobs immediately when going online
      fetchPendingJobs();

      // Set up interval to fetch jobs every 10 seconds
      const interval = setInterval(() => {
        fetchPendingJobs();
      }, 10000);

      setJobFetchInterval(interval);
    } else {
      // Clear interval when going offline
      if (jobFetchInterval) {
        clearInterval(jobFetchInterval);
        setJobFetchInterval(null);
      }
      setPendingJobs([]);
    }

    return () => {
      if (jobFetchInterval) {
        clearInterval(jobFetchInterval);
      }
    };
  }, [isOnline, currentLocation]);

  // Fetch pending jobs function
  const fetchPendingJobs = async () => {
    if (!isOnline || !currentLocation) return;

    try {
      setIsFetchingJobs(true);
      const response = await api.get('/drivers/pending-jobs');

      if (response.success) {
        setPendingJobs(response.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching pending jobs:', error);
      // Don't show alert for continuous fetching errors
    } finally {
      setIsFetchingJobs(false);
    }
  };

  // Accept job function
  const acceptJob = async (job) => {
    try {
      // Stop job fetching while accepting
      if (jobFetchInterval) {
        clearInterval(jobFetchInterval);
        setJobFetchInterval(null);
      }

      let response;
      if (job.type === 'ride') {
        response = await api.put(`/rides/${job.id}/accept`);
      } else if (job.type === 'delivery') {
        response = await api.put(`/deliveries/${job.id}/accept`);
      }

      if (response.success) {
        Alert.alert(
          'Job Accepted!',
          `You have accepted the ${job.type}. Navigate to your active job screen.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // For now, just show success alert
                // In a real app, navigate to active job screen
                setPendingJobs([]); // Clear accepted job from list
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error accepting job:', error);
      Alert.alert(
        'Error',
        'Failed to accept job. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Resume job fetching after error
              if (isOnline) {
                fetchPendingJobs();
              }
            },
          },
        ]
      );
    }
  };

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPendingJobs();
    setRefreshing(false);
  };

  // Toggle driver availability
  const toggleAvailability = async () => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Please wait for your location to be determined.');
      return;
    }

    try {
      setToggleLoading(true);

      await api.put('/drivers/availability', {
        available: !isOnline,
        location: currentLocation
      });

      setIsOnline(!isOnline);

      const status = !isOnline ? 'online' : 'offline';
      Alert.alert('Success', `You are now ${status}!`);
    } catch (error) {
      console.error('Toggle availability error:', error);
      Alert.alert('Error', 'Failed to update availability. Please try again.');
    } finally {
      setToggleLoading(false);
    }
  };

  if (locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Online/Offline Toggle */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isOnline ? styles.offlineButton : styles.onlineButton
          ]}
          onPress={toggleAvailability}
          disabled={toggleLoading}
        >
          {toggleLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.toggleButtonText}>
              {isOnline ? 'Go Offline' : 'Go Online'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Status: </Text>
          <Text style={[
            styles.statusValue,
            isOnline ? styles.onlineStatus : styles.offlineStatus
          ]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Map View */}
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={true}
        userLocationUpdateInterval={5000}
      >
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Your Location"
            description={isOnline ? "You're online and ready to accept rides" : "You're currently offline"}
            pinColor={isOnline ? '#4CAF50' : '#FF9800'}
          />
        )}
      </MapView>

      {/* Footer with Stats */}
      <View style={styles.footer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Today's Earnings</Text>
          <Text style={styles.statValue}>$0.00</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Completed Rides</Text>
          <Text style={styles.statValue}>0</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Rating</Text>
          <Text style={styles.statValue}>N/A</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1,
    alignItems: 'center',
  },
  toggleButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    minWidth: 150,
    alignItems: 'center',
  },
  onlineButton: {
    backgroundColor: '#4CAF50',
  },
  offlineButton: {
    backgroundColor: '#FF6B35',
  },
  toggleButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusContainer: {
    flexDirection: 'row',
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2.22,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  onlineStatus: {
    color: '#4CAF50',
  },
  offlineStatus: {
    color: '#FF9800',
  },
  map: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default DriverHomeScreen;