/**
 * Delivery Tracking Screen
 * Real-time delivery tracking after booking confirmation
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

const DeliveryTrackingScreen = ({ route, navigation }) => {
  const { deliveryId, pickup, destination, packageType, fare } = route.params;
  const { user } = useAuth();

  const [deliveryStatus, setDeliveryStatus] = useState('requested');
  const [statusText, setStatusText] = useState('Finding Driver...');
  const [driverInfo, setDriverInfo] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
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

  // Fetch delivery status from backend
  const fetchDeliveryStatus = async () => {
    try {
      const response = await api.get(`/deliveries/${deliveryId}`);
      const deliveryData = response.data;

      setDeliveryStatus(deliveryData.status);

      // Update status text based on delivery status
      switch (deliveryData.status) {
        case 'requested':
          setStatusText('Finding Driver...');
          setDriverInfo(null);
          break;
        case 'confirmed':
          setStatusText('Driver En Route');
          setDriverInfo(deliveryData.driver);
          break;
        case 'driver_assigned':
          setStatusText('Driver Assigned - On the way');
          setDriverInfo(deliveryData.driver);
          break;
        case 'picked_up':
          setStatusText('Package Picked Up');
          setDriverInfo(deliveryData.driver);
          break;
        case 'in_transit':
          setStatusText('Delivery in Progress');
          setDriverInfo(deliveryData.driver);
          break;
        case 'completed':
          setStatusText('Delivery Completed');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setTimeout(() => {
            Alert.alert(
              'Delivery Completed!',
              'Your package has been delivered successfully!',
              [
                { text: 'Rate Driver', onPress: () => console.log('Rate driver') },
                { text: 'Home', onPress: () => navigation.navigate('Home') }
              ]
            );
          }, 1000);
          break;
        case 'cancelled':
          setStatusText('Delivery Cancelled');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setTimeout(() => {
            Alert.alert(
              'Delivery Cancelled',
              deliveryData.cancelReason || 'Your delivery has been cancelled.',
              [
                { text: 'OK', onPress: () => navigation.navigate('Home') }
              ]
            );
          }, 1000);
          break;
        default:
          setStatusText('Processing...');
      }

      // If driver is assigned, use driver location from delivery response
      if (deliveryData.driver && deliveryData.driver.currentLocation) {
        setDriverLocation({
          latitude: deliveryData.driver.currentLocation.latitude,
          longitude: deliveryData.driver.currentLocation.longitude
        });
      }

      setError(null);
    } catch (error) {
      console.error('Error fetching delivery status:', error);
      setError('Failed to fetch delivery status');
    }
  };

  // Start polling delivery status
  useEffect(() => {
    fetchDeliveryStatus(); // Initial fetch

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchDeliveryStatus, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [deliveryId]);

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
                rideId: deliveryId, // Using deliveryId as reference
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

  // Handle cancel delivery
  const handleCancelDelivery = () => {
    Alert.alert(
      'Cancel Delivery',
      'Are you sure you want to cancel this delivery?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await api.put(`/deliveries/${deliveryId}/cancel`, {
                reason: 'User cancelled',
                cancelledBy: 'user'
              });

              Alert.alert('Delivery Cancelled', 'Your delivery has been cancelled.');
              navigation.navigate('Home');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel delivery. Please try again.');
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
          <Text style={styles.headerTitle}>Delivery Tracking</Text>
          <Text style={styles.deliveryId}>Delivery #{deliveryId.slice(-6)}</Text>
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
          title="Delivery Location"
          description={destination.address}
          pinColor="#FF6B35"
        />

        {/* Driver Marker */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="Driver Location"
            description={driverInfo?.name || 'Your driver'}
            pinColor="#4CAF50"
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
            {deliveryStatus === 'requested' && <ActivityIndicator size="small" color="#FF6B35" />}
            {deliveryStatus === 'confirmed' && <Icon name="car" size={24} color="#4CAF50" />}
            {deliveryStatus === 'driver_assigned' && <Icon name="car" size={24} color="#2196F3" />}
            {deliveryStatus === 'picked_up' && <Icon name="package" size={24} color="#FF9800" />}
            {deliveryStatus === 'in_transit' && <Icon name="play" size={24} color="#9C27B0" />}
            {deliveryStatus === 'completed' && <Icon name="check-circle" size={24} color="#4CAF50" />}
            {deliveryStatus === 'cancelled' && <Icon name="close-circle" size={24} color="#F44336" />}
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusText}>{statusText}</Text>
            <Text style={styles.statusSubtext}>
              {deliveryStatus === 'requested' && 'Finding available drivers nearby...'}
              {deliveryStatus === 'confirmed' && `${driverInfo?.name || 'Driver'} is on the way`}
              {deliveryStatus === 'driver_assigned' && 'Your driver has been assigned'}
              {deliveryStatus === 'picked_up' && 'Package has been picked up'}
              {deliveryStatus === 'in_transit' && 'Enjoy your delivery!'}
              {deliveryStatus === 'completed' && 'Thank you for using Quick Pickup!'}
              {deliveryStatus === 'cancelled' && 'This delivery has been cancelled'}
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
          {deliveryStatus !== 'completed' && deliveryStatus !== 'cancelled' && (
            <TouchableOpacity
              style={[styles.cancelButton, loading && styles.disabledButton]}
              onPress={handleCancelDelivery}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel Delivery</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchDeliveryStatus}>
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
    backgroundColor: '#4CAF50',
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
  deliveryId: {
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
    backgroundColor: '#4CAF50',
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
    color: '#4CAF50',
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

export default DeliveryTrackingScreen;