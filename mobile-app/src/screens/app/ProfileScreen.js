/**
 * Profile Screen
 * User profile management and settings
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useAuth} from '../../context/AuthContext';

const ProfileScreen = ({navigation}) => {
  const {user, signOut} = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Icon name="account-circle" size={80} color="#FF6B35" />
          </View>
          <Text style={styles.name}>{user?.name || 'User'}</Text>
          <Text style={styles.phone}>{user?.phoneNumber}</Text>
          <Text style={styles.role}>
            {user?.role === 'driver' ? 'Driver' : 'User'} Account
          </Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ProfileEdit')}
          >
            <Icon name="account-edit" size={24} color="#333" />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('EmergencyContact')}
          >
            <Icon name="phone" size={24} color="#333" />
            <Text style={styles.menuText}>Emergency Contact</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="translate" size={24} color="#333" />
            <Text style={styles.menuText}>Language</Text>
            <Text style={styles.menuValue}>English</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Icon name="file-document-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Terms & Conditions</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="shield-lock-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Icon name="help-circle-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Help & Support</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        </View>

        {user?.role === 'user' && (
          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('DriverRegistration')}
            >
              <Icon name="car" size={24} color="#FF6B35" />
              <Text style={styles.menuText}>Become a Driver</Text>
              <Icon name="chevron-right" size={24} color="#999" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}>
          <Icon name="logout" size={20} color="#E53935" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.version}>Quick Pickup v1.0.0</Text>
          <Text style={styles.footerText}>
            For testing purposes only
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  role: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    marginLeft: 12,
  },
  menuValue: {
    fontSize: 14,
    color: '#999999',
    marginRight: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E53935',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  version: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 10,
    color: '#CCCCCC',
  },
});

export default ProfileScreen;
