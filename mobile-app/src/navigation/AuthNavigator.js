/**
 * Authentication Navigator
 * Screens for login/signup flow
 */

import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import PhoneInputScreen from '../screens/auth/PhoneInputScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: '#FFFFFF'},
      }}>
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
