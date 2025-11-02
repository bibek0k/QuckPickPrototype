/**
 * Driver Navigator
 * Bottom tabs for driver-specific functionality
 */

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import ProfileScreen from '../screens/app/ProfileScreen';

const Tab = createBottomTabNavigator();

// Placeholder Earnings Screen (will be implemented later)
const EarningsScreen = () => {
  return React.createElement('EarningsScreen', null, [
    React.createElement('View', {
      key: 'container',
      style: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
      }
    }, [
      React.createElement('Icon', {
        key: 'icon',
        name: 'cash',
        size: 64,
        color: '#FF6B35'
      }),
      React.createElement('Text', {
        key: 'title',
        style: {
          fontSize: 24,
          fontWeight: 'bold',
          color: '#333',
          marginTop: 16
        }
      }, 'Earnings'),
      React.createElement('Text', {
        key: 'subtitle',
        style: {
          fontSize: 16,
          color: '#666',
          marginTop: 8,
          textAlign: 'center',
          paddingHorizontal: 32
        }
      }, 'Your earnings and statistics\nComing soon!')
    ])
  ]);
};

const DriverNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused, color, size}) => {
          let iconName;

          if (route.name === 'DriverHome') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Earnings') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'DriverProfile') {
            iconName = focused ? 'account' : 'account-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}>
      <Tab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
        }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default DriverNavigator;