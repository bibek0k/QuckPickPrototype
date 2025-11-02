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
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';

const EmergencyContactScreen = ({ navigation }) => {
  const { user, updateProfile } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: 'family',
  });
  const [errors, setErrors] = useState({});

  const relationships = [
    { value: 'family', label: 'Family Member' },
    { value: 'friend', label: 'Friend' },
    { value: 'spouse', label: 'Spouse' },
    { value: 'parent', label: 'Parent' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'other', label: 'Other' },
  ];

  useEffect(() => {
    // Load existing emergency contacts from user profile
    if (user?.emergencyContact) {
      setContacts(Array.isArray(user.emergencyContact) ? user.emergencyContact : [user.emergencyContact]);
    }
  }, [user]);

  const validatePhoneNumber = (phone) => {
    // Indian phone number format validation
    const phoneRegex = /^[+]?[91]?[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  };

  const validateContact = () => {
    const newErrors = {};

    if (!newContact.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!newContact.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhoneNumber(newContact.phone)) {
      newErrors.phone = 'Invalid phone number format. Use: +91XXXXXXXXXX';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddContact = () => {
    if (!validateContact()) {
      return;
    }

    const contactToAdd = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      phone: newContact.phone.replace(/\s+/g, ''),
      relationship: newContact.relationship,
      isPrimary: contacts.length === 0, // First contact is primary
    };

    const updatedContacts = [...contacts, contactToAdd];
    setContacts(updatedContacts);

    // Reset form
    setNewContact({ name: '', phone: '', relationship: 'family' });
    setErrors({});
    setShowAddForm(false);

    // Save to profile
    saveContacts(updatedContacts);
  };

  const handleDeleteContact = (contactId) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedContacts = contacts.filter(contact => contact.id !== contactId);

            // If primary was deleted, make first contact primary
            if (updatedContacts.length > 0) {
              updatedContacts[0].isPrimary = true;
            }

            setContacts(updatedContacts);
            saveContacts(updatedContacts);
          },
        },
      ]
    );
  };

  const handleSetPrimary = (contactId) => {
    const updatedContacts = contacts.map(contact => ({
      ...contact,
      isPrimary: contact.id === contactId,
    }));
    setContacts(updatedContacts);
    saveContacts(updatedContacts);
  };

  const saveContacts = async (updatedContacts) => {
    try {
      await updateProfile({
        emergencyContact: updatedContacts,
      });
    } catch (error) {
      console.error('Error saving emergency contacts:', error);
      Alert.alert('Error', 'Failed to save emergency contacts');
    }
  };

  const handleTestContact = (contact) => {
    Alert.alert(
      'Test Emergency Contact',
      `Send test message to ${contact.name} (${contact.phone})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Test',
          onPress: () => {
            // In a real app, this would send an SMS or make a call
            Alert.alert(
              'Test Sent',
              `Test message sent to ${contact.name}. This is a simulation.`
            );
          },
        },
      ]
    );
  };

  const renderContactItem = ({ item }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactInfo}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName}>{item.name}</Text>
          {item.isPrimary && (
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryText}>Primary</Text>
            </View>
          )}
        </View>
        <Text style={styles.contactPhone}>{item.phone}</Text>
        <Text style={styles.contactRelationship}>
          {relationships.find(r => r.value === item.relationship)?.label || item.relationship}
        </Text>
      </View>

      <View style={styles.contactActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.testButton]}
          onPress={() => handleTestContact(item)}
        >
          <Icon name="message-text" size={20} color="#4CAF50" />
        </TouchableOpacity>

        {!item.isPrimary && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => handleSetPrimary(item.id)}
          >
            <Icon name="star" size={20} color="#FF9800" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteContact(item.id)}
        >
          <Icon name="delete" size={20} color="#E53935" />
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(true)}
        >
          <Icon name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Icon name="information" size={24} color="#FF6B35" />
            <Text style={styles.infoTitle}>Emergency Contacts</Text>
          </View>
          <Text style={styles.infoText}>
            These contacts will be notified in case of an emergency during your ride.
            You can add multiple contacts and set one as primary.
          </Text>
        </View>

        {/* Add Contact Form */}
        {showAddForm && (
          <View style={styles.addFormSection}>
            <Text style={styles.formTitle}>Add Emergency Contact</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contact Name</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={newContact.name}
                onChangeText={(text) => {
                  setNewContact({ ...newContact, name: text });
                  if (errors.name) {
                    setErrors({ ...errors, name: '' });
                  }
                }}
                placeholder="Enter contact name"
                autoCapitalize="words"
                maxLength={50}
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                value={newContact.phone}
                onChangeText={(text) => {
                  setNewContact({ ...newContact, phone: text });
                  if (errors.phone) {
                    setErrors({ ...errors, phone: '' });
                  }
                }}
                placeholder="+91XXXXXXXXXX"
                keyboardType="phone-pad"
                maxLength={13}
              />
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Relationship</Text>
              <View style={styles.relationshipContainer}>
                {relationships.map((rel) => (
                  <TouchableOpacity
                    key={rel.value}
                    style={[
                      styles.relationshipOption,
                      newContact.relationship === rel.value && styles.selectedRelationship,
                    ]}
                    onPress={() => setNewContact({ ...newContact, relationship: rel.value })}
                  >
                    <Text
                      style={[
                        styles.relationshipText,
                        newContact.relationship === rel.value && styles.selectedRelationshipText,
                      ]}
                    >
                      {rel.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddForm(false);
                  setNewContact({ name: '', phone: '', relationship: 'family' });
                  setErrors({});
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formButton, styles.addButton]}
                onPress={handleAddContact}
              >
                <Text style={styles.addButtonText}>Add Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Contacts List */}
        <View style={styles.contactsSection}>
          <Text style={styles.sectionTitle}>
            Emergency Contacts ({contacts.length})
          </Text>

          {contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="phone-missed" size={60} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>
                No emergency contacts added
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Add emergency contacts who will be notified in case of an emergency
              </Text>
            </View>
          ) : (
            <FlatList
              data={contacts}
              renderItem={renderContactItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* SOS Settings */}
        <View style={styles.sosSection}>
          <Text style={styles.sosTitle}>SOS Settings</Text>
          <View style={styles.sosOption}>
            <Icon name="bell" size={24} color="#FF6B35" />
            <View style={styles.sosOptionText}>
              <Text style={styles.sosOptionTitle}>Auto-notify emergency contacts</Text>
              <Text style={styles.sosOptionSubtext}>
                Contacts will be automatically notified when you trigger SOS
              </Text>
            </View>
            <View style={styles.toggle}>
              <Icon name="toggle-switch" size={40} color="#4CAF50" />
            </View>
          </View>
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
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  infoSection: {
    backgroundColor: '#FFF3E0',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  addFormSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
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
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginTop: 4,
  },
  relationshipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationshipOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  selectedRelationship: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  relationshipText: {
    fontSize: 14,
    color: '#666666',
  },
  selectedRelationshipText: {
    color: '#FFFFFF',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  formButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  addButton: {
    backgroundColor: '#FF6B35',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
  contactItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contactInfo: {
    flex: 1,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginRight: 8,
  },
  primaryBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  primaryText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  contactRelationship: {
    fontSize: 12,
    color: '#999999',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  testButton: {
    backgroundColor: '#E8F5E8',
  },
  primaryButton: {
    backgroundColor: '#FFF3E0',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  sosSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sosTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  sosOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  sosOptionText: {
    flex: 1,
    marginLeft: 12,
  },
  sosOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  sosOptionSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  toggle: {
    marginLeft: 12,
  },
});

export default EmergencyContactScreen;