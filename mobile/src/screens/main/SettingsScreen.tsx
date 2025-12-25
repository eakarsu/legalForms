/**
 * Settings Screen - App settings and preferences
 */

import React from 'react';
import {View, Text, StyleSheet, ScrollView, Alert} from 'react-native';
import {
  Card,
  TextInput,
  Button,
  Divider,
  IconButton,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useFormik} from 'formik';
import * as Yup from 'yup';

import {useAuthStore} from '../../store/authStore';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius, shadows} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'Settings'>;

const profileSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
});

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {user, updateUser} = useAuthStore();

  const formik = useFormik({
    initialValues: {
      name: user?.name || '',
      email: user?.email || '',
    },
    validationSchema: profileSchema,
    onSubmit: async values => {
      try {
        updateUser(values);
        Alert.alert('Success', 'Profile updated successfully');
      } catch (error) {
        Alert.alert('Error', 'Failed to update profile');
      }
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* Profile Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Card style={styles.card}>
            <Card.Content>
              <TextInput
                mode="outlined"
                label="Full Name"
                value={formik.values.name}
                onChangeText={formik.handleChange('name')}
                error={formik.touched.name && !!formik.errors.name}
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />

              <TextInput
                mode="outlined"
                label="Email"
                value={formik.values.email}
                onChangeText={formik.handleChange('email')}
                error={formik.touched.email && !!formik.errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                outlineStyle={styles.inputOutline}
              />

              <Button
                mode="contained"
                onPress={() => formik.handleSubmit()}
                style={styles.saveButton}
                contentStyle={styles.buttonContent}>
                Save Changes
              </Button>
            </Card.Content>
          </Card>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Push Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Receive notifications about document updates
                  </Text>
                </View>
                <Icon name="toggle-on" size={28} color={colors.primary} />
              </View>
              <Divider style={styles.divider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Email Notifications</Text>
                  <Text style={styles.settingDescription}>
                    Receive email updates about your account
                  </Text>
                </View>
                <Icon name="toggle-on" size={28} color={colors.primary} />
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <Card style={styles.card}>
            <Card.Content>
              <Button
                mode="outlined"
                icon="lock"
                onPress={() => Alert.alert('Coming Soon', 'Change password feature')}
                style={styles.settingButton}
                contentStyle={styles.settingButtonContent}>
                Change Password
              </Button>
              <Button
                mode="outlined"
                icon="shield-check"
                onPress={() => Alert.alert('Coming Soon', '2FA settings')}
                style={styles.settingButton}
                contentStyle={styles.settingButtonContent}>
                Two-Factor Authentication
              </Button>
            </Card.Content>
          </Card>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Storage</Text>
          <Card style={styles.card}>
            <Card.Content>
              <Button
                mode="outlined"
                icon="download"
                onPress={() => Alert.alert('Coming Soon', 'Export data feature')}
                style={styles.settingButton}
                contentStyle={styles.settingButtonContent}>
                Export My Data
              </Button>
              <Button
                mode="outlined"
                icon="cached"
                onPress={() => Alert.alert('Success', 'Cache cleared')}
                style={styles.settingButton}
                contentStyle={styles.settingButtonContent}>
                Clear Cache
              </Button>
            </Card.Content>
          </Card>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.error}]}>
            Danger Zone
          </Text>
          <Card style={[styles.card, styles.dangerCard]}>
            <Card.Content>
              <Button
                mode="outlined"
                icon="delete-forever"
                textColor={colors.error}
                onPress={() =>
                  Alert.alert(
                    'Delete Account',
                    'This will permanently delete your account and all data. This cannot be undone.',
                    [
                      {text: 'Cancel', style: 'cancel'},
                      {text: 'Delete', style: 'destructive'},
                    ],
                  )
                }
                style={[styles.settingButton, styles.dangerButton]}
                contentStyle={styles.settingButtonContent}>
                Delete Account
              </Button>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  input: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  inputOutline: {
    borderRadius: borderRadius.md,
  },
  saveButton: {
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  buttonContent: {
    height: 48,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  settingButton: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  settingButtonContent: {
    height: 48,
    justifyContent: 'flex-start',
  },
  dangerButton: {
    borderColor: colors.error,
    marginBottom: 0,
  },
});

export default SettingsScreen;
