/**
 * Trip History Screen
 * Shows past rides and deliveries
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const TripHistoryScreen = () => {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trip History</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Empty State */}
        <View style={styles.emptyState}>
          <Icon name="history" size={80} color="#E0E0E0" />
          <Text style={styles.emptyText}>No trips yet</Text>
          <Text style={styles.emptySubtext}>
            Your ride and delivery history will appear here
          </Text>
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 120,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#999999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCCCCC',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default TripHistoryScreen;
