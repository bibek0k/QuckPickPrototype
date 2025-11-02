import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import { launchImageLibrary } from 'react-native-image-picker';

const ProfileEditScreen = ({ navigation }) => {
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profilePhoto: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Pre-fill form with existing user data
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      profilePhoto: user?.profilePhotoUrl || null,
    });
  }, [user]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickImage = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 300,
      maxWidth: 300,
      quality: 0.7,
    };

    launchImageLibrary(options, (response) => {
      // Handle user cancellation
      if (response.didCancel) {
        return;
      }

      // Handle errors
      if (response.error) {
        console.error('ImagePicker Error: ', response.error);
        Alert.alert('Error', 'Failed to pick image');
        return;
      }

      // Handle successful selection
      if (response.assets && response.assets[0]) {
        setFormData({
          ...formData,
          profilePhoto: response.assets[0].uri,
        });
      }
    });
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const updateData = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
      };

      // In a real app, you would upload the image to Firebase Storage
      // For now, we'll just use the local URI
      if (formData.profilePhoto && formData.profilePhoto !== user?.profilePhotoUrl) {
        updateData.profilePhotoUrl = formData.profilePhoto;
      }

      await updateProfile(updateData);

      Alert.alert(
        'Success',
        'Profile updated successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderProfilePhoto = () => {
    if (formData.profilePhoto) {
      return (
        <Image
          source={{ uri: formData.profilePhoto }}
          style={styles.profilePhoto}
          onError={() => {
            console.log('Failed to load profile photo');
            setFormData({ ...formData, profilePhoto: null });
          }}
        />
      );
    } else {
      return (
        <View style={styles.defaultAvatar}>
          <Icon name="account" size={60} color="#FFFFFF" />
        </View>
      );
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.disabledButton]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoContainer} onPress={handlePickImage}>
            {renderProfilePhoto()}
            <View style={styles.cameraOverlay}>
              <Icon name="camera" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Name Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => {
                setFormData({ ...formData, name: text });
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
              placeholder="Enter your full name"
              autoCapitalize="words"
              maxLength={50}
            />
            {errors.name && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}
          </View>

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address (Optional)</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
              placeholder="Enter your email address"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={100}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email}</Text>
            )}
          </View>

          {/* Phone Number (Read-only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={[styles.input, styles.readOnlyInput]}>
              <Text style={styles.readOnlyText}>{user?.phoneNumber}</Text>
            </View>
            <Text style={styles.hintText}>
              Phone number cannot be changed. Contact support if needed.
            </Text>
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>Account Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <Text style={styles.infoValue}>
              {user?.role === 'driver' ? 'Driver' : 'User'} Account
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age Verification</Text>
            <View style={styles.verificationStatus}>
              <Icon
                name={user?.ageVerified ? 'check-circle' : 'clock'}
                size={16}
                color={user?.ageVerified ? '#4CAF50' : '#FF9800'}
              />
              <Text
                style={[
                  styles.verificationText,
                  { color: user?.ageVerified ? '#4CAF50' : '#FF9800' },
                ]}
              >
                {user?.ageVerified ? 'Verified' : 'Not Verified'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {user?.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
            </Text>
          </View>
        </View>

        {/* Delete Account Section */}
        <View style={styles.dangerSection}>
          <TouchableOpacity style={styles.dangerButton}>
            <Icon name="delete-forever" size={24} color="#E53935" />
            <Text style={styles.dangerText}>Delete Account</Text>
            <Icon name="chevron-right" size={24} color="#CCCCCC" />
          </TouchableOpacity>
          <Text style={styles.dangerHint}>
            Permanently delete your account and all data
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
  saveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  defaultAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  photoHint: {
    fontSize: 14,
    color: '#666666',
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#E53935',
  },
  readOnlyInput: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666666',
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
  },
  infoSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoRow:lastChild: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666666',
  },
  infoValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dangerSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 24,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E53935',
    marginBottom: 8,
  },
  dangerText: {
    flex: 1,
    fontSize: 16,
    color: '#E53935',
    fontWeight: '600',
    marginLeft: 12,
  },
  dangerHint: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
  },
});

export default ProfileEditScreen;