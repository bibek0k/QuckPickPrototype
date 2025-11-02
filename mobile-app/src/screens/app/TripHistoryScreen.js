/**
 * Trip History Screen
 * Shows past rides and deliveries with data from backend
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/api';

const TripHistoryScreen = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('rides'); // 'rides' or 'deliveries'
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTripHistory();
  }, [activeTab]);

  const fetchTripHistory = async () => {
    try {
      setError(null);
      const endpoint = activeTab === 'rides'
        ? '/rides/my-history'
        : '/deliveries/my-history';

      const response = await api.get(endpoint);
      setTrips(response[activeTab] || []);
    } catch (error) {
      console.error('Error fetching trip history:', error);
      setError('Failed to load trip history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTripHistory();
    setRefreshing(false);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const renderTripItem = ({ item }) => {
    const isRide = activeTab === 'rides';

    return (
      <View style={styles.tripItem}>
        <View style={styles.tripHeader}>
          <View style={styles.tripDateContainer}>
            <Text style={styles.tripDate}>{formatDate(item.createdAt)}</Text>
            <Text style={styles.tripTime}>{formatTime(item.createdAt)}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.status === 'completed' && styles.completedBadge,
            item.status === 'cancelled' && styles.cancelledBadge
          ]}>
            <Text style={[
              styles.statusText,
              item.status === 'completed' && styles.completedText,
              item.status === 'cancelled' && styles.cancelledText
            ]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.tripRoute}>
          <View style={styles.routeRow}>
            <Icon name="map-marker" size={16} color="#4CAF50" />
            <Text style={styles.routeText} numberOfLines={1}>
              From: {isRide ? item.pickup?.address : item.pickup?.address}
            </Text>
          </View>
          <Icon name="arrow-down" size={16} color="#666" style={styles.arrowIcon} />
          <View style={styles.routeRow}>
            <Icon name="map-marker" size={16} color="#FF6B35" />
            <Text style={styles.routeText} numberOfLines={1}>
              To: {isRide ? item.destination?.address : item.destination?.address}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <View style={styles.tripDetails}>
            <Text style={styles.tripType}>
              {isRide ? '🚗 Ride' : '📦 Delivery'}
            </Text>
            {item.vehicleType && (
              <Text style={styles.vehicleType}>
                {isRide ? item.vehicleType.charAt(0).toUpperCase() + item.vehicleType.slice(1) : item.packageType?.charAt(0).toUpperCase() + item.packageType?.slice(1)}
              </Text>
            )}
          </View>
          <View style={styles.tripFareContainer}>
            <Text style={styles.tripFare}>
              ₹{item.fare ? item.fare.toFixed(2) : '0.00'}
            </Text>
          </View>
        </View>

        {item.status === 'cancelled' && item.cancellationReason && (
          <View style={styles.cancellationReason}>
            <Text style={styles.cancellationText}>
              Reason: {item.cancellationReason}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="history" size={80} color="#E0E0E0" />
      <Text style={styles.emptyText}>
        No {activeTab} yet
      </Text>
      <Text style={styles.emptySubtext}>
        Your {activeTab} history will appear here
      </Text>
      {error && (
        <TouchableOpacity style={styles.retryButton} onPress={fetchTripHistory}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Loading trip history...</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trip History</Text>
        </View>
        {renderLoadingState()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip History</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rides' && styles.activeTab]}
          onPress={() => setActiveTab('rides')}
        >
          <Text style={[styles.tabText, activeTab === 'rides' && styles.activeTabText]}>
            Rides
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'deliveries' && styles.activeTab]}
          onPress={() => setActiveTab('deliveries')}
        >
          <Text style={[styles.tabText, activeTab === 'deliveries' && styles.activeTabText]}>
            Deliveries
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {error && !loading && trips.length === 0 ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTripHistory}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmptyState()}
        />
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
    backgroundColor: '#FF6B35',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FF6B35',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  tripItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripDateContainer: {
    flex: 1,
  },
  tripDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  tripTime: {
    fontSize: 14,
    color: '#666666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  completedBadge: {
    backgroundColor: '#E8F5E8',
  },
  cancelledBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  completedText: {
    color: '#2E7D32',
  },
  cancelledText: {
    color: '#C62828',
  },
  tripRoute: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    marginLeft: 8,
  },
  arrowIcon: {
    alignSelf: 'center',
    marginVertical: 2,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  tripDetails: {
    flex: 1,
  },
  tripType: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  vehicleType: {
    fontSize: 12,
    color: '#999999',
  },
  tripFareContainer: {
    alignItems: 'flex-end',
  },
  tripFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  cancellationReason: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
  },
  cancellationText: {
    fontSize: 12,
    color: '#E65100',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TripHistoryScreen;
