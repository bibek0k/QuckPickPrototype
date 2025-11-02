import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import VehicleTypeSelector from '../../components/VehicleTypeSelector';
import api from '../../config/api';

const { width, height } = Dimensions.get('window');

const RideConfirmationScreen = ({ route, navigation }) => {
  const { pickup, destination } = route.params;
  const { user } = useAuth();
  const [selectedVehicle, setSelectedVehicle] = useState('economy');
  const [fareEstimates, setFareEstimates] = useState({
    economy: { baseFare: 150, distanceFare: 12, timeFare: 2, total: 164 },
    comfort: { baseFare: 200, distanceFare: 15, timeFare: 3, total: 218 },
    xl: { baseFare: 250, distanceFare: 18, timeFare: 4, total: 272 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fareLoading, setFareLoading] = useState(true);
  const [distance, setDistance] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);

  useEffect(() => {
    fetchFareEstimates();
  }, [pickup, destination]);

  const fetchFareEstimates = async () => {
    try {
      setFareLoading(true);

      const response = await api.post('/rides/estimate', {
        pickup: {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        }
      });

      if (response.success) {
        // Transform server response to match expected format
        const transformedEstimates = {};
        Object.keys(response.estimates).forEach(vehicleType => {
          transformedEstimates[vehicleType] = {
            baseFare: response.estimates[vehicleType].breakdown.base,
            distanceFare: response.estimates[vehicleType].breakdown.distance,
            timeFare: response.estimates[vehicleType].breakdown.time,
            total: response.estimates[vehicleType].fare,
          };
        });

        setFareEstimates(transformedEstimates);
        setDistance(response.distance);
        setEstimatedTime(response.duration);
      }
    } catch (error) {
      console.error('Error fetching fare estimates:', error);
      Alert.alert('Error', 'Unable to calculate fare. Please try again.');
    } finally {
      setFareLoading(false);
    }
  };

  const handleConfirmRide = async () => {
    setIsLoading(true);

    try {
      // This would integrate with the actual API in production
      const rideData = {
        userId: user.uid,
        pickup: {
          address: pickup.address,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
        destination: {
          address: destination.address,
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
        vehicleType: selectedVehicle,
        fare: fareEstimates[selectedVehicle].total,
        notes: '',
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock successful ride creation
      Alert.alert(
        'Ride Confirmed!',
        'Your ride has been booked successfully. Driver will be assigned shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('RideTracking', {
                rideId: 'mock_ride_id', // This would come from API
                pickup,
                destination,
                vehicleType: selectedVehicle,
                fare: fareEstimates[selectedVehicle].total,
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error booking ride:', error);
      Alert.alert('Error', 'Failed to book ride. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedFare = fareEstimates[selectedVehicle];

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
        <Text style={styles.headerTitle}>Confirm Your Ride</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Route Information */}
        <View style={styles.section}>
          <View style={styles.routeContainer}>
            <View style={styles.locationRow}>
              <View style={[styles.dot, styles.greenDot]} />
              <View style={styles.locationText}>
                <Text style={styles.locationLabel}>PICKUP</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {pickup.address}
                </Text>
              </View>
            </View>

            <View style={styles.line} />

            <View style={styles.locationRow}>
              <View style={[styles.dot, styles.redDot]} />
              <View style={styles.locationText}>
                <Text style={styles.locationLabel}>DROPOFF</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {destination.address}
                </Text>
              </View>
            </View>
          </View>

          {/* Trip Details */}
          <View style={styles.tripDetails}>
            <View style={styles.tripDetailRow}>
              <Icon name="map-marker-distance" size={20} color="#666666" />
              <Text style={styles.tripDetailText}>{distance} km</Text>
            </View>
            <View style={styles.tripDetailRow}>
              <Icon name="clock" size={20} color="#666666" />
              <Text style={styles.tripDetailText}>{estimatedTime} min</Text>
            </View>
          </View>
        </View>

        {/* Vehicle Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Your Vehicle</Text>
          <VehicleTypeSelector
            selected={selectedVehicle}
            onSelect={setSelectedVehicle}
            fareEstimates={fareEstimates}
          />
        </View>

        {/* Fare Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fare Breakdown</Text>
          {fareLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.loadingText}>Calculating fare...</Text>
            </View>
          ) : (
            <View style={styles.fareBreakdown}>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Base Fare</Text>
                <Text style={styles.fareValue}>₹{selectedFare.baseFare}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Distance Fare ({distance} km)</Text>
                <Text style={styles.fareValue}>₹{selectedFare.distanceFare}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Time Fare ({estimatedTime} min)</Text>
                <Text style={styles.fareValue}>₹{selectedFare.timeFare}</Text>
              </View>
              <View style={[styles.fareRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Fare</Text>
                <Text style={styles.totalValue}>₹{selectedFare.total}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethod}>
            <Icon name="cash" size={24} color="#4CAF50" />
            <View style={styles.paymentText}>
              <Text style={styles.paymentTitle}>Cash</Text>
              <Text style={styles.paymentSubtitle}>Pay the driver directly</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#CCCCCC" />
          </View>
        </View>

        {/* Safety Information */}
        <View style={styles.section}>
          <View style={styles.safetyInfo}>
            <Icon name="shield-check" size={20} color="#4CAF50" />
            <Text style={styles.safetyText}>
              Your ride is tracked with GPS for your safety. Share trip details with emergency contacts.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, isLoading && styles.disabledButton]}
          onPress={handleConfirmRide}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>Confirm Ride</Text>
              <Text style={styles.confirmButtonFare}>₹{selectedFare.total}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  routeContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
    marginTop: 4,
  },
  greenDot: {
    backgroundColor: '#4CAF50',
  },
  redDot: {
    backgroundColor: '#FF6B35',
  },
  line: {
    width: 2,
    height: 30,
    backgroundColor: '#CCCCCC',
    marginLeft: 5,
    marginHorizontal: 16,
  },
  locationText: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666666',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripDetailText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  fareBreakdown: {
    // No specific styles needed
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    marginTop: 4,
  },
  fareLabel: {
    fontSize: 16,
    color: '#666666',
  },
  fareValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  totalLabel: {
    fontSize: 18,
    color: '#333333',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  paymentText: {
    flex: 1,
    marginLeft: 12,
  },
  paymentTitle: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  paymentSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  safetyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  safetyText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  confirmButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmButtonFare: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#666666',
  },
});

export default RideConfirmationScreen;