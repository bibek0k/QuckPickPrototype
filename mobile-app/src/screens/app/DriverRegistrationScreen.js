import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const DriverRegistrationScreen = ({ navigation }) => {
  const { user } = useAuth();

  // Form state
  const [vehicleType, setVehicleType] = useState('economy');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  // Document state
  const [driverLicense, setDriverLicense] = useState(null);
  const [vehicleRegistration, setVehicleRegistration] = useState(null);
  const [vehicleInsurance, setVehicleInsurance] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Request storage permission
  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Access Required',
            message: 'Quick Pickup needs access to your storage to upload documents',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Storage permission error:', err);
        return false;
      }
    }
    return true; // iOS permissions are handled automatically
  };

  // Image picker function
  const selectImage = (documentType) => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorMessage) {
        console.error('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Error', 'Failed to select image. Please try again.');
      } else {
        const source = response.assets[0];

        // Validate file size (5MB limit)
        if (source.fileSize && source.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'File size must be less than 5MB');
          return;
        }

        // Validate file type
        if (!source.type.includes('jpeg') && !source.type.includes('jpg') && !source.type.includes('png')) {
          Alert.alert('Error', 'Only JPEG and PNG files are allowed');
          return;
        }

        // Set the appropriate document
        switch (documentType) {
          case 'driverLicense':
            setDriverLicense(source);
            break;
          case 'vehicleRegistration':
            setVehicleRegistration(source);
            break;
          case 'vehicleInsurance':
            setVehicleInsurance(source);
            break;
          case 'profilePhoto':
            setProfilePhoto(source);
            break;
        }
      }
    });
  };

  // Remove uploaded document
  const removeDocument = (documentType) => {
    switch (documentType) {
      case 'driverLicense':
        setDriverLicense(null);
        break;
      case 'vehicleRegistration':
        setVehicleRegistration(null);
        break;
      case 'vehicleInsurance':
        setVehicleInsurance(null);
        break;
      case 'profilePhoto':
        setProfilePhoto(null);
        break;
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = [];

    // Vehicle information validation
    if (!vehicleMake.trim()) errors.push('Vehicle make is required');
    if (!vehicleModel.trim()) errors.push('Vehicle model is required');
    if (!vehicleYear.trim()) errors.push('Vehicle year is required');
    else if (isNaN(vehicleYear) || vehicleYear.length !== 4 || vehicleYear < 1990 || vehicleYear > new Date().getFullYear()) {
      errors.push('Please enter a valid vehicle year');
    }
    if (!vehicleColor.trim()) errors.push('Vehicle color is required');
    if (!licensePlate.trim()) errors.push('License plate is required');
    else if (licensePlate.length < 4 || licensePlate.length > 15) {
      errors.push('License plate must be between 4 and 15 characters');
    }

    // Document validation
    if (!driverLicense) errors.push('Driver\'s license is required');
    if (!vehicleRegistration) errors.push('Vehicle registration is required');
    if (!vehicleInsurance) errors.push('Vehicle insurance is required');

    // Terms validation
    if (!termsAccepted) errors.push('You must accept the terms and conditions');

    return errors;
  };

  // Handle form submission
  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'));
      return;
    }

    setIsLoading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();

      // Add vehicle information
      formData.append('vehicleType', vehicleType);
      formData.append('vehicleMake', vehicleMake.trim());
      formData.append('vehicleModel', vehicleModel.trim());
      formData.append('vehicleYear', vehicleYear.trim());
      formData.append('vehicleColor', vehicleColor.trim());
      formData.append('licensePlate', licensePlate.trim().toUpperCase());

      // Add documents
      if (driverLicense) {
        formData.append('driverLicense', {
          uri: driverLicense.uri,
          type: driverLicense.type,
          name: driverLicense.fileName || 'driver_license.jpg',
        });
      }

      if (vehicleRegistration) {
        formData.append('vehicleRegistration', {
          uri: vehicleRegistration.uri,
          type: vehicleRegistration.type,
          name: vehicleRegistration.fileName || 'vehicle_registration.jpg',
        });
      }

      if (vehicleInsurance) {
        formData.append('vehicleInsurance', {
          uri: vehicleInsurance.uri,
          type: vehicleInsurance.type,
          name: vehicleInsurance.fileName || 'vehicle_insurance.jpg',
        });
      }

      if (profilePhoto) {
        formData.append('profilePhoto', {
          uri: profilePhoto.uri,
          type: profilePhoto.type,
          name: profilePhoto.fileName || 'profile_photo.jpg',
        });
      }

      // Make API call
      const response = await api.post('/drivers/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.success) {
        Alert.alert(
          'Registration Submitted!',
          'Your driver registration has been submitted successfully. You will be notified once your documents are verified.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Registration failed. Please try again.';

      if (error.response) {
        errorMessage = error.response.data?.message || 'Server error occurred';
      } else if (error.request) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const vehicleTypes = [
    { value: 'economy', label: 'Economy', icon: 'car' },
    { value: 'comfort', label: 'Comfort', icon: 'car-sports' },
    { value: 'xl', label: 'XL', icon: 'car-estate' },
  ];

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
        <Text style={styles.headerTitle}>Driver Registration</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressText}>Step 1 of 2: Vehicle Information</Text>
        </View>

        {/* Vehicle Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Type</Text>
          <View style={styles.vehicleTypeContainer}>
            {vehicleTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.vehicleTypeButton,
                  vehicleType === type.value && styles.selectedVehicleType,
                ]}
                onPress={() => setVehicleType(type.value)}
              >
                <Icon
                  name={type.icon}
                  size={32}
                  color={vehicleType === type.value ? '#FF6B35' : '#666666'}
                />
                <Text
                  style={[
                    styles.vehicleTypeText,
                    vehicleType === type.value && styles.selectedVehicleTypeText,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Make</Text>
              <TextInput
                style={styles.input}
                value={vehicleMake}
                onChangeText={setVehicleMake}
                placeholder="e.g., Toyota"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Model</Text>
              <TextInput
                style={styles.input}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="e.g., Camry"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Year</Text>
              <TextInput
                style={styles.input}
                value={vehicleYear}
                onChangeText={setVehicleYear}
                placeholder="e.g., 2020"
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Color</Text>
              <TextInput
                style={styles.input}
                value={vehicleColor}
                onChangeText={setVehicleColor}
                placeholder="e.g., Blue"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>License Plate</Text>
            <TextInput
              style={styles.input}
              value={licensePlate}
              onChangeText={setLicensePlate}
              placeholder="e.g., ABC 1234"
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Document Uploads */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Documents</Text>

          <DocumentUpload
            title="Driver's License"
            subtitle="Upload a clear photo of your valid driver's license"
            document={driverLicense}
            onUpload={() => selectImage('driverLicense')}
            onRemove={() => removeDocument('driverLicense')}
            required
          />

          <DocumentUpload
            title="Vehicle Registration"
            subtitle="Upload your vehicle registration certificate"
            document={vehicleRegistration}
            onUpload={() => selectImage('vehicleRegistration')}
            onRemove={() => removeDocument('vehicleRegistration')}
            required
          />

          <DocumentUpload
            title="Vehicle Insurance"
            subtitle="Upload your valid vehicle insurance proof"
            document={vehicleInsurance}
            onUpload={() => selectImage('vehicleInsurance')}
            onRemove={() => removeDocument('vehicleInsurance')}
            required
          />

          <DocumentUpload
            title="Profile Photo (Optional)"
            subtitle="Upload a professional profile photo"
            document={profilePhoto}
            onUpload={() => selectImage('profilePhoto')}
            onRemove={() => removeDocument('profilePhoto')}
            required={false}
          />
        </View>

        {/* Terms and Conditions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setTermsAccepted(!termsAccepted)}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkedCheckbox]}>
              {termsAccepted && <Icon name="check" size={16} color="#FFFFFF" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the Terms of Service and Privacy Policy. I understand that my documents will be verified before I can start accepting rides.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Registration</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

// Document Upload Component
const DocumentUpload = ({ title, subtitle, document, onUpload, onRemove, required }) => (
  <View style={styles.documentContainer}>
    <View style={styles.documentHeader}>
      <Text style={styles.documentTitle}>
        {title} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <Text style={styles.documentSubtitle}>{subtitle}</Text>
    </View>

    {document ? (
      <View style={styles.uploadedDocument}>
        <Icon name="file-image" size={24} color="#4CAF50" />
        <Text style={styles.documentName} numberOfLines={1}>
          {document.fileName || 'Document uploaded'}
        </Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
        >
          <Icon name="close" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity style={styles.uploadButton} onPress={onUpload}>
        <Icon name="cloud-upload" size={24} color="#FF6B35" />
        <Text style={styles.uploadButtonText}>Upload Document</Text>
      </TouchableOpacity>
    )}
  </View>
);

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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  progressContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    width: '50%',
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#666666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehicleTypeButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  selectedVehicleType: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF8F5',
  },
  vehicleTypeText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  selectedVehicleTypeText: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputContainer: {
    flex: 1,
    marginRight: 8,
  },
  inputContainer: {
    flex: 1,
    marginRight: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  documentContainer: {
    marginBottom: 16,
  },
  documentHeader: {
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  required: {
    color: '#F44336',
  },
  documentSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  uploadedDocument: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    marginLeft: 8,
  },
  removeButton: {
    padding: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#FF6B35',
    marginLeft: 8,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkedCheckbox: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  submitContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default DriverRegistrationScreen;