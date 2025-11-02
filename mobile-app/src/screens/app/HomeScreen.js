/**
 * Home Screen
 * Main screen with dual tabs for Quick Ride and Quick Pickup Express
 */

import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {useAuth} from '../../context/AuthContext';

const {width} = Dimensions.get('window');

const HomeScreen = ({navigation}) => {
  const [activeTab, setActiveTab] = useState('ride');
  const {user} = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: 28.6139, // Default: Delhi
    longitude: 77.2090,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const mapRef = useRef(null);

  // Request location permission and get current location
  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Access Required',
            message: 'This app needs to access your location for ride booking',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          getCurrentLocation();
        } else {
          Alert.alert('Permission Denied', 'Location permission is required for this feature');
        }
      } catch (err) {
        console.warn(err);
      }
    }
  };

  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        const newLocation = {
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setUserLocation(newLocation);
        setMapRegion(newLocation);
        setPickupLocation('Current Location');
        setPickupCoords({latitude, longitude});

        // Animate map to user location
        if (mapRef.current) {
          mapRef.current.animateToRegion(newLocation, 1000);
        }
      },
      error => {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Could not get your current location');
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const handleMapPress = (e) => {
    const {coordinate} = e.nativeEvent;

    if (!destinationCoords) {
      // Set destination if pickup is already set
      setDestinationCoords(coordinate);
      setDestinationLocation(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
      // Could integrate Google Places API here for address lookup
    } else {
      // Reset and set new pickup
      setPickupCoords(coordinate);
      setPickupLocation(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
      setDestinationCoords(null);
      setDestinationLocation('');
      setRouteCoordinates([]);
    }
  };

  const handleBookNow = () => {
    if (!pickupCoords || !destinationCoords) {
      Alert.alert('Missing Information', 'Please set both pickup and destination locations');
      return;
    }

    if (activeTab === 'ride') {
      navigation.navigate('RideConfirmation', {
        pickup: {
          address: pickupLocation,
          latitude: pickupCoords.latitude,
          longitude: pickupCoords.longitude,
        },
        destination: {
          address: destinationLocation,
          latitude: destinationCoords.latitude,
          longitude: destinationCoords.longitude,
        },
      });
    } else {
      // Handle delivery booking
      Alert.alert('Delivery', 'Delivery booking flow coming soon');
    }
  };

  const centerMapOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(userLocation, 1000);
    } else {
      getCurrentLocation();
    }
  };

  // Update route when both locations are set
  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      // This would integrate with Google Directions API in production
      // For now, create a simple straight line
      setRouteCoordinates([pickupCoords, destinationCoords]);
    }
  }, [pickupCoords, destinationCoords]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'User'}!</Text>
          <Text style={styles.subGreeting}>Where would you like to go?</Text>
        </View>
        <TouchableOpacity style={styles.languageToggle}>
          <Text style={styles.languageText}>EN</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ride' && styles.activeTab]}
          onPress={() => setActiveTab('ride')}>
          <Icon
            name="car"
            size={24}
            color={activeTab === 'ride' ? '#FFFFFF' : '#FF6B35'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'ride' && styles.activeTabText,
            ]}>
            Quick Ride
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'delivery' && styles.activeTab]}
          onPress={() => setActiveTab('delivery')}>
          <Icon
            name="package-variant"
            size={24}
            color={activeTab === 'delivery' ? '#FFFFFF' : '#4CAF50'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'delivery' && styles.activeTabText,
            ]}>
            Quick Pickup Express
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map Content Area */}
      <View style={styles.content}>
        <KeyboardAvoidingView style={styles.container} behavior="padding">
          {/* Location Inputs */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <Icon name="map-marker" size={20} color="#4CAF50" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter pickup location"
                value={pickupLocation}
                onChangeText={setPickupLocation}
                editable={false} // Will be set via map tap
              />
            </View>

            <View style={[styles.inputRow, styles.destinationInput]}>
              <Icon name="map-marker" size={20} color="#FF6B35" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter destination"
                value={destinationLocation}
                onChangeText={setDestinationLocation}
                editable={false} // Will be set via map tap
              />
            </View>
          </View>

          {/* Map View */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={mapRegion}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              showsScale={true}
              loadingEnabled={true}
            >
              {/* Pickup Marker */}
              {pickupCoords && (
                <Marker
                  coordinate={pickupCoords}
                  title="Pickup"
                  description={pickupLocation}
                  pinColor="#4CAF50"
                />
              )}

              {/* Destination Marker */}
              {destinationCoords && (
                <Marker
                  coordinate={destinationCoords}
                  title="Destination"
                  description={destinationLocation}
                  pinColor="#FF6B35"
                />
              )}

              {/* Route Line */}
              {routeCoordinates.length > 1 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#FF6B35"
                  strokeWidth={3}
                  lineDashPattern={[10, 5]}
                />
              )}
            </MapView>

            {/* Map Controls */}
            <TouchableOpacity style={styles.locationButton} onPress={centerMapOnUser}>
              <Icon name="crosshairs-gps" size={24} color="#FF6B35" />
            </TouchableOpacity>
          </View>

          {/* Book Now Button */}
          {pickupCoords && destinationCoords && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.bookButton}
                onPress={handleBookNow}
                activeOpacity={0.8}
              >
                <Text style={styles.bookButtonText}>
                  {activeTab === 'ride' ? 'Book Ride' : 'Send Package'}
                </Text>
                <Icon
                  name={activeTab === 'ride' ? 'car' : 'package-variant'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Instructions */}
          {!pickupCoords && !destinationCoords && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                Tap on the map to set pickup location
              </Text>
            </View>
          )}

          {pickupCoords && !destinationCoords && (
            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                Tap on the map to set destination
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
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
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subGreeting: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  languageToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  languageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B35',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  destinationInput: {
    marginBottom: 0,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  bookButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF6B35',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  instructionsText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default HomeScreen;
