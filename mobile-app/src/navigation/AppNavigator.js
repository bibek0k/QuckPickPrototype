/**
 * Main App Navigator
 * Bottom tabs for Quick Ride and Quick Pickup Express
 */

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import HomeScreen from '../screens/app/HomeScreen';
import ProfileScreen from '../screens/app/ProfileScreen';
import TripHistoryScreen from '../screens/app/TripHistoryScreen';
import RideTrackingScreen from '../screens/app/RideTrackingScreen';
import DeliveryWizardScreen from '../screens/app/DeliveryWizardScreen';
import DeliveryTrackingScreen from '../screens/app/DeliveryTrackingScreen';
import DriverRegistrationScreen from '../screens/app/DriverRegistrationScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack navigator for home screens (will contain ride and delivery flows)
const HomeStack = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen
        name="RideTracking"
        component={RideTrackingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryWizard"
        component={DeliveryWizardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryTracking"
        component={DeliveryTrackingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverRegistration"
        component={DriverRegistrationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused, color, size}) => {
          let iconName;

          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'history' : 'history';
          } else if (route.name === 'Profile') {
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
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen
        name="History"
        component={TripHistoryScreen}
        options={{
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;
