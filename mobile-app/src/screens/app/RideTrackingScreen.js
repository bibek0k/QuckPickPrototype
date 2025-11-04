/**
 * Ride Tracking Screen
 * Real-time ride tracking after booking confirmation
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';

const { width, height } = Dimensions.get('window');

const RideTrackingScreen = ({ route, navigation }) => {
  const { rideId, pickup, destination, vehicleType, fare } = route.params;
  const { user } = useAuth();

  const [rideStatus, setRideStatus] = useState('requested');
  const [statusText, setStatusText] = useState('Waiting for Driver...');
  const [driverInfo, setDriverInfo] = useState(null);
  const [driverLocation, setDriverLocation] = null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const intervalRef = useRef(null);

  // Initial map region
  const [region, setRegion] = useState({
    latitude: (pickup.latitude + destination.latitude) / 2,
    longitude: (pickup.longitude + destination.longitude) / 2,
    latitudeDelta: Math.abs(pickup.latitude - destination.latitude) * 1.5,
    longitudeDelta: Math.abs(pickup.longitude - destination.longitude) * 1.5,
  });

  // Fetch ride status from backend
  const fetchRideStatus = async () => {
    try {
      const response = await api.get(`/rides/${rideId}`);
      const rideData = response.data;

      setRideStatus(rideData.status);

      // Update status text based on ride status
      switch (rideData.status) {
        case 'requested':
          setStatusText('Waiting for Driver...');
          setDriverInfo(null);
          break;
        case 'confirmed':
          setStatusText('Driver En Route');
          setDriverInfo(rideData.driver);
          break;
        case 'driver_assigned':
          setStatusText('Driver Assigned - On the way');
          setDriverInfo(rideData.driver);
          break;
        case 'arriving':
          setStatusText('Driver Arriving');
          setDriverInfo(rideData.driver);
          break;
        case 'in_progress':
          setStatusText('Ride in Progress');
          setDriverInfo(rideData.driver);
          break;
        case 'completed':
          setStatusText('Ride Completed');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setTimeout(() => {
            Alert.alert(
              'Ride Completed!',
              'Thank you for riding with Quick Pickup!',
              [
                { text: 'Rate Driver', onPress: () => console.log('Rate driver') },
                { text: 'Home', onPress: () => navigation.navigate('Home') }
              ]
            );
          }, 1000);
          break;
        case 'cancelled':
          setStatusText('Ride Cancelled');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setTimeout(() => {
            Alert.alert(
              'Ride Cancelled',
              rideData.cancelReason || 'Your ride has been cancelled.',
              [
                { text: 'OK', onPress: () => navigation.navigate('Home') }
              ]
            );
          }, 1000);
          break;
        default:
          setStatusText('Processing...');
      }

      // If driver is assigned, use driver location from ride response
      if (rideData.driver && rideData.driver.currentLocation) {
        setDriverLocation({
          latitude: rideData.driver.currentLocation.latitude,
          longitude: rideData.driver.currentLocation.longitude
        });
      }

      setError(null);
    } catch (error) {
      console.error('Error fetching ride status:', error);
      setError('Failed to fetch ride status');
    }
  };

  // Fetch driver location
  const fetchDriverLocation = async (driverId) => {
    try {
      const response = await api.get(`/drivers/${driverId}/location`);
      const locationData = response.data.location;

      if (locationData) {
        setDriverLocation({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
      }
    } catch (error) {
      console.error('Error fetching driver location:', error);
    }
  };

  // Start polling ride status
  useEffect(() => {
    fetchRideStatus(); // Initial fetch

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchRideStatus, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [rideId]);

  // Fit map to show all markers
  useEffect(() => {
    if (mapRef.current) {
      const markers = [
        { latitude: pickup.latitude, longitude: pickup.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
      ];

      if (driverLocation) {
        markers.push(driverLocation);
      }

      mapRef.current.fitToCoordinates(markers, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    }
  }, [driverLocation]);

  // Handle contact driver
  const handleContactDriver = () => {
    if (driverInfo?.phoneNumber) {
      Alert.alert(
        'Contact Driver',
        `Would you like to call ${driverInfo.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Call',
            onPress: () => Linking.openURL(`tel:${driverInfo.phoneNumber}`)
          }
        ]
      );
    }
  };

  // Handle emergency SOS
  const handleEmergencySOS = () => {
    Alert.alert(
      'Emergency SOS',
      'Are you sure you want to trigger emergency assistance?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Send SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/sos/create', {
                rideId,
                location: driverLocation || pickup,
                emergency: true
              });
              Alert.alert('SOS Sent', 'Emergency services have been notified.');
            } catch (error) {
              Alert.alert('Error', 'Failed to send SOS. Please call emergency services directly.');
            }
          }
        }
      ]
    );
  };

  // Handle cancel ride
  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.put(`/rides/${rideId}/cancel`, {
                reason: 'User cancelled',
                cancelledBy: 'user'
              });

              Alert.alert('Ride Cancelled', 'Your ride has been cancelled.');
              navigation.navigate('Home');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel ride. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Format time
  const formatTime = (date) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Ride Tracking</Text>
          <Text style={styles.rideId}>Ride #{rideId.slice(-6)}</Text>
        </View>
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={handleEmergencySOS}
        >
          <Icon name="phone-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
      >
        {/* Pickup Marker */}
        <Marker
          coordinate={{
            latitude: pickup.latitude,
            longitude: pickup.longitude,
          }}
          title="Pickup Location"
          description={pickup.address}
          pinColor="#4CAF50"
        />

        {/* Destination Marker */}
        <Marker
          coordinate={{
            latitude: destination.latitude,
            longitude: destination.longitude,
          }}
          title="Destination"
          description={destination.address}
          pinColor="#FF6B35"
        />

        {/* Driver Marker */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Driver Location"
            description={driverInfo?.name || 'Your driver'}
            pinColor="#2196F3"
          />
        )}

        {/* Route Line */}
        {driverLocation && (
          <Polyline
            coordinates={[
              driverLocation,
              { latitude: pickup.latitude, longitude: pickup.longitude },
              { latitude: destination.latitude, longitude: destination.longitude },
            ]}
            strokeColor="#FF6B35"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Status Display */}
        <View style={styles.statusContainer}>
          <View style={styles.statusIcon}>
            {rideStatus === 'requested' && <ActivityIndicator size="small" color="#FF6B35" />}
            {rideStatus === 'confirmed' && <Icon name="car" size={24} color="#4CAF50" />}
            {rideStatus === 'driver_assigned' && <Icon name="car" size={24} color="#2196F3" />}
            {rideStatus === 'arriving' && <Icon name="map-marker" size={24} color="#FF9800" />}
            {rideStatus === 'in_progress' && <Icon name="play" size={24} color="#9C27B0" />}
            {rideStatus === 'completed' && <Icon name="check-circle" size={24} color="#4CAF50" />}
            {rideStatus === 'cancelled' && <Icon name="close-circle" size={24} color="#F44336" />}
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.statusSubtext}>
              {rideStatus === 'requested' && 'Finding available drivers nearby...'}
              {rideStatus === 'confirmed' && `${driverInfo?.name || 'Driver'} is on the way`}
              {rideStatus === 'driver_assigned' && 'Your driver has been assigned'}
              {rideStatus === 'arriving' && 'Driver is arriving at pickup location'}
              {rideStatus === 'in_progress' && 'Enjoy your ride!'}
              {rideStatus === 'completed' && 'Thank you for riding with Quick Pickup!'}
              {rideStatus === 'cancelled' && 'This ride has been cancelled'}
            </Text>
          </View>
        </View>

        {/* Driver Info */}
        {driverInfo && (
          <View style={styles.driverInfoContainer}>
            <View style={styles.driverDetails}>
              <View style={styles.driverAvatar}>
                <Icon name="account" size={32} color="#FFFFFF" />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{driverInfo.name}</Text>
                <Text style={styles.vehicleInfo}>
                  {driverInfo.vehicleInfo?.make} {driverInfo.vehicleInfo?.model} • {driverInfo.vehicleInfo?.licensePlate}
                </Text>
                <Text style={styles.rating}>
                  ⭐ {driverInfo.rating || '4.8'} • {driverInfo.totalRides || 0} rides
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={handleContactDriver}
            >
              <Icon name="phone" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Trip Details */}
        <View style={styles.tripDetailsContainer}>
          <View style={styles.tripDetailRow}>
            <Icon name="map-marker" size={16} color="#666" />
            <Text style={styles.tripDetailText} numberOfLines={1}>
              {pickup.address}
            </Text>
          </View>
          <Icon name="arrow-down" size={16} color="#666" style={styles.arrowIcon} />
          <View style={styles.tripDetailRow}>
            <Icon name="map-marker" size={16} color="#666" />
            <Text style={styles.tripDetailText} numberOfLines={1}>
              {destination.address}
            </Text>
          </View>
          <View style={styles.tripFareRow}>
            <Text style={styles.tripFareLabel}>Total Fare</Text>
            <Text style={styles.tripFareValue}>₹{fare || '0'}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {rideStatus !== 'completed' && rideStatus !== 'cancelled' && (
            <TouchableOpacity
              style={[styles.cancelButton, loading && styles.disabledButton]}
              onPress={handleCancelRide}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Ride</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchRideStatus}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  rideId: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  emergencyButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  map: {
    flex: 1,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  driverInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  driverDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  rating: {
    fontSize: 12,
    color: '#FF6B35',
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripDetailsContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripDetailText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  arrowIcon: {
    alignSelf: 'center',
    marginVertical: 4,
  },
  tripFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tripFareLabel: {
    fontSize: 16,
    color: '#666666',
  },
  tripFareValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  actionButtons: {
    padding: 20,
  },
  cancelButton: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default RideTrackingScreen;