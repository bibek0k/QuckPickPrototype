/**
 * Delivery Wizard Screen
 * 3-step wizard for delivery booking: Location, Package Details, Confirmation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';

const { width, height } = Dimensions.get('window');

const DeliveryWizardScreen = ({ route, navigation }) => {
  const { pickup, destination } = route.params;
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);

  // Package details state
  const [packageType, setPackageType] = useState('Document');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [packageValue, setPackageValue] = useState('');

  // Map region for step 1
  const [mapRegion, setMapRegion] = useState({
    latitude: (pickup.latitude + destination.latitude) / 2,
    longitude: (pickup.longitude + destination.longitude) / 2,
    latitudeDelta: Math.abs(pickup.latitude - destination.latitude) * 1.5,
    longitudeDelta: Math.abs(pickup.longitude - destination.longitude) * 1.5,
  });

  // Package types
  const packageTypes = ['Document', 'Food', 'Parcel', 'Clothing', 'Electronics', 'Other'];

  // Calculate delivery fare on mount
  useEffect(() => {
    fetchDeliveryEstimate();
  }, [pickup, destination]);

  const fetchDeliveryEstimate = async () => {
    if (!pickup || !destination) return;

    try {
      const response = await api.post('/deliveries/estimate', {
        pickup: {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          address: pickup.address
        },
        destination: {
          latitude: destination.latitude,
          longitude: destination.longitude,
          address: destination.address
        },
        packageType: packageType.toLowerCase()
      });

      if (response.success && response.estimate) {
        setDeliveryFee(response.estimate.fare);
        setEstimatedTime(response.estimate.duration);
      }
    } catch (error) {
      console.error('Error fetching delivery estimate:', error);
      setDeliveryFee(100); // Default fare
      setEstimatedTime(30); // Default time
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!validateStep2()) {
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep2 = () => {
    if (!recipientName.trim()) {
      Alert.alert('Missing Information', 'Please enter recipient name');
      return false;
    }
    if (!recipientPhone.trim()) {
      Alert.alert('Missing Information', 'Please enter recipient phone number');
      return false;
    }
    if (recipientPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleConfirmDelivery = async () => {
    if (!validateStep2()) {
      return;
    }

    try {
      setLoading(true);

      const deliveryData = {
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
        packageType: packageType.toLowerCase(),
        fare: deliveryFee,
        recipientName: recipientName,
        recipientPhone: recipientPhone.startsWith('+') ? recipientPhone : `+91${recipientPhone}`,
        notes: specialInstructions,
      };

      // Create delivery via API
      const response = await api.post('/deliveries/create', deliveryData);

      Alert.alert(
        'Delivery Confirmed!',
        'Your package has been registered for delivery. A driver will be assigned shortly.',
        [
          {
            text: 'Track Delivery',
            onPress: () => navigation.navigate('DeliveryTracking', {
              deliveryId: response.delivery?.id || 'mock_delivery_id'
            })
          },
          {
            text: 'Home',
            onPress: () => navigation.navigate('Home')
          }
        ]
      );
    } catch (error) {
      console.error('Error creating delivery:', error);
      Alert.alert('Error', 'Failed to create delivery. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => {
    const steps = [
      { number: 1, label: 'Location' },
      { number: 2, label: 'Package' },
      { number: 3, label: 'Confirm' },
    ];

    return (
      <View style={styles.progressContainer}>
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;

          return (
            <View key={step.number} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  isCompleted && styles.completedDot,
                  isCurrent && styles.currentDot,
                ]}
              >
                {isCompleted ? (
                  <Icon name="check" size={16} color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.progressDotText,
                      isCurrent && styles.currentDotText,
                    ]}
                  >
                    {step.number}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.progressLabel,
                  isCurrent && styles.currentLabel,
                  isCompleted && styles.completedLabel,
                ]}
              >
                {step.label}
              </Text>
              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    isCompleted && styles.completedLine,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Delivery Route</Text>
      <Text style={styles.stepDescription}>Review your pickup and delivery locations</Text>

      <View style={styles.locationsContainer}>
        <View style={styles.locationItem}>
          <Icon name="map-marker" size={24} color="#4CAF50" />
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>PICKUP</Text>
            <Text style={styles.locationAddress}>{pickup.address}</Text>
          </View>
        </View>

        <Icon name="arrow-down" size={24} color="#666" style={styles.arrowIcon} />

        <View style={styles.locationItem}>
          <Icon name="map-marker" size={24} color="#FF6B35" />
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>DELIVERY</Text>
            <Text style={styles.locationAddress}>{destination.address}</Text>
          </View>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          showsUserLocation={true}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker
            coordinate={{
              latitude: pickup.latitude,
              longitude: pickup.longitude,
            }}
            title="Pickup"
            description={pickup.address}
            pinColor="#4CAF50"
          />
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Delivery"
            description={destination.address}
            pinColor="#FF6B35"
          />
          <Polyline
            coordinates={[
              {
                latitude: pickup.latitude,
                longitude: pickup.longitude,
              },
              {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            ]}
            strokeColor="#4CAF50"
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        </MapView>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Package Details</Text>
      <Text style={styles.stepDescription}>Tell us about your package</Text>

      <View style={styles.formContainer}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Package Type *</Text>
          <View style={styles.packageTypesContainer}>
            {packageTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.packageTypeButton,
                  packageType === type && styles.selectedPackageType,
                ]}
                onPress={() => setPackageType(type)}
              >
                <Text
                  style={[
                    styles.packageTypeText,
                    packageType === type && styles.selectedPackageTypeText,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Recipient Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter recipient's full name"
            value={recipientName}
            onChangeText={setRecipientName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Recipient Phone *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter recipient's phone number"
            value={recipientPhone}
            onChangeText={setRecipientPhone}
            keyboardType="phone-pad"
            maxLength={15}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Package Value (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter package value for insurance"
            value={packageValue}
            onChangeText={setPackageValue}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Special Instructions (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any special handling instructions..."
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Confirm Delivery</Text>
      <Text style={styles.stepDescription}>Review your delivery details</Text>

      <View style={styles.confirmationContainer}>
        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationTitle}>Route</Text>
          <View style={styles.confirmationRoute}>
            <View style={styles.confirmationLocation}>
              <Icon name="map-marker" size={16} color="#4CAF50" />
              <Text style={styles.confirmationLocationText} numberOfLines={1}>
                {pickup.address}
              </Text>
            </View>
            <Icon name="arrow-down" size={16} color="#666" />
            <View style={styles.confirmationLocation}>
              <Icon name="map-marker" size={16} color="#FF6B35" />
              <Text style={styles.confirmationLocationText} numberOfLines={1}>
                {destination.address}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationTitle}>Package Details</Text>
          <View style={styles.confirmationDetails}>
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>Type:</Text>
              <Text style={styles.confirmationValue}>{packageType}</Text>
            </View>
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>Recipient:</Text>
              <Text style={styles.confirmationValue}>{recipientName}</Text>
            </View>
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>Phone:</Text>
              <Text style={styles.confirmationValue}>{recipientPhone}</Text>
            </View>
            {specialInstructions && (
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Instructions:</Text>
                <Text style={styles.confirmationValue}>{specialInstructions}</Text>
              </View>
            )}
            {packageValue && (
              <View style={styles.confirmationRow}>
                <Text style={styles.confirmationLabel}>Value:</Text>
                <Text style={styles.confirmationValue}>₹{packageValue}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.confirmationSection}>
          <Text style={styles.confirmationTitle}>Delivery Details</Text>
          <View style={styles.confirmationDetails}>
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>Est. Time:</Text>
              <Text style={styles.confirmationValue}>{estimatedTime} minutes</Text>
            </View>
            <View style={styles.confirmationRow}>
              <Text style={styles.confirmationLabel}>Delivery Fee:</Text>
              <Text style={styles.confirmationValue}>₹{deliveryFee}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
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
        <Text style={styles.headerTitle}>Quick Pickup Express</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        {currentStep > 1 && (
          <TouchableOpacity
            style={styles.backButtonFooter}
            onPress={handleBack}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            loading && styles.disabledButton,
            currentStep === 3 && styles.confirmButton,
          ]}
          onPress={currentStep === 3 ? handleConfirmDelivery : handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === 3 ? 'Confirm Delivery' : 'Next'}
            </Text>
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
    backgroundColor: '#4CAF50',
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  completedDot: {
    backgroundColor: '#4CAF50',
  },
  currentDot: {
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#81C784',
  },
  progressDotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  currentDotText: {
    color: '#FFFFFF',
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  currentLabel: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  completedLabel: {
    color: '#4CAF50',
  },
  progressLine: {
    position: 'absolute',
    top: 16,
    right: '-50%',
    width: '100%',
    height: 2,
    backgroundColor: '#E0E0E0',
    zIndex: -1,
  },
  completedLine: {
    backgroundColor: '#4CAF50',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  // Step 1 Styles
  locationsContainer: {
    marginBottom: 20,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 16,
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
  arrowIcon: {
    alignSelf: 'center',
    marginVertical: 8,
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  // Step 2 Styles
  formContainer: {
    // No specific styles needed
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  packageTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packageTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedPackageType: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  packageTypeText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  selectedPackageTypeText: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  // Step 3 Styles
  confirmationContainer: {
    // No specific styles needed
  },
  confirmationSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  confirmationSection:lastChild {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  confirmationRoute: {
    // No specific styles needed
  },
  confirmationLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmationLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  confirmationDetails: {
    // No specific styles needed
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  confirmationLabel: {
    fontSize: 16,
    color: '#666666',
  },
  confirmationValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  backButtonFooter: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666666',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#FF6B35',
  },
  disabledButton: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default DeliveryWizardScreen;