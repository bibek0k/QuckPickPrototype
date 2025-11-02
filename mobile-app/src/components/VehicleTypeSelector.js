import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const VehicleTypeSelector = ({ selected, onSelect, fareEstimates }) => {
  const vehicleTypes = [
    {
      id: 'economy',
      name: 'Economy',
      icon: 'car',
      description: 'Affordable rides',
      capacity: '4 seats',
      time: '2 min',
    },
    {
      id: 'comfort',
      name: 'Comfort',
      icon: 'car-sports',
      description: 'Comfortable cars',
      capacity: '4 seats',
      time: '3 min',
    },
    {
      id: 'xl',
      name: 'XL',
      icon: 'car-estate',
      description: 'For larger groups',
      capacity: '6 seats',
      time: '5 min',
    },
  ];

  return (
    <View style={styles.container}>
      {vehicleTypes.map((vehicle) => {
        const fare = fareEstimates[vehicle.id];
        const isSelected = selected === vehicle.id;

        return (
          <TouchableOpacity
            key={vehicle.id}
            style={[styles.vehicleOption, isSelected && styles.selectedOption]}
            onPress={() => onSelect(vehicle.id)}
            activeOpacity={0.8}
          >
            <View style={styles.vehicleInfo}>
              <View style={styles.iconContainer}>
                <Icon
                  name={vehicle.icon}
                  size={32}
                  color={isSelected ? '#FF6B35' : '#666666'}
                />
              </View>
              <View style={styles.vehicleDetails}>
                <View style={styles.vehicleHeader}>
                  <Text style={[styles.vehicleName, isSelected && styles.selectedText]}>
                    {vehicle.name}
                  </Text>
                  <Text style={[styles.fare, isSelected && styles.selectedFare]}>
                    ₹{fare.total}
                  </Text>
                </View>
                <Text style={styles.description}>{vehicle.description}</Text>
                <View style={styles.vehicleStats}>
                  <View style={styles.stat}>
                    <Icon name="account-group" size={14} color="#666666" />
                    <Text style={styles.statText}>{vehicle.capacity}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Icon name="clock" size={14} color="#666666" />
                    <Text style={styles.statText}>{vehicle.time}</Text>
                  </View>
                </View>
              </View>
            </View>
            {isSelected && (
              <View style={styles.selectedIndicator}>
                <Icon name="check-circle" size={24} color="#FF6B35" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // No specific container styles needed
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: '#FFF5F0',
    borderColor: '#FF6B35',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  selectedText: {
    color: '#FF6B35',
  },
  fare: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  selectedFare: {
    color: '#FF6B35',
  },
  description: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  vehicleStats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666666',
  },
  selectedIndicator: {
    marginLeft: 12,
  },
});

export default VehicleTypeSelector;