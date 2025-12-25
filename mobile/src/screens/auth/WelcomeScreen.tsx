/**
 * Welcome Screen - Onboarding/Landing screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import {Button} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {colors, spacing, borderRadius} from '../../utils/theme';

const {width, height} = Dimensions.get('window');

type WelcomeScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Welcome'
>;

interface Props {
  navigation: WelcomeScreenNavigationProp;
}

const WelcomeScreen: React.FC<Props> = ({navigation}) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Gradient Background */}
      <View style={styles.gradientBg}>
        <View style={styles.topSection}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Icon name="balance-scale" size={32} color={colors.primary} />
            </View>
            <Text style={styles.logoText}>
              LegalPractice<Text style={styles.logoAccent}>AI</Text>
            </Text>
          </View>

          {/* Hero Content */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              Professional Legal{'\n'}Documents with AI
            </Text>
            <Text style={styles.heroSubtitle}>
              Generate accurate legal documents in minutes.{'\n'}
              Business formation, real estate, family law & more.
            </Text>
          </View>

          {/* Features */}
          <View style={styles.features}>
            <View style={styles.featureItem}>
              <Icon name="check-circle" size={18} color={colors.success} solid />
              <Text style={styles.featureText}>36+ Document Templates</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check-circle" size={18} color={colors.success} solid />
              <Text style={styles.featureText}>AI-Powered Generation</Text>
            </View>
            <View style={styles.featureItem}>
              <Icon name="check-circle" size={18} color={colors.success} solid />
              <Text style={styles.featureText}>State Compliance</Text>
            </View>
          </View>
        </View>

        {/* Bottom Section */}
        <SafeAreaView edges={['bottom']} style={styles.bottomSection}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Register')}
            style={styles.primaryButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}>
            Get Started Free
          </Button>

          <Button
            mode="outlined"
            onPress={() => navigation.navigate('Login')}
            style={styles.secondaryButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.secondaryButtonLabel}>
            Sign In
          </Button>

          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBg: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  topSection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textLight,
  },
  logoAccent: {
    color: '#a5b4fc',
  },
  heroContent: {
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textLight,
    lineHeight: 44,
    marginBottom: spacing.md,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 24,
  },
  features: {
    marginTop: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  featureText: {
    color: colors.textLight,
    fontSize: 16,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  bottomSection: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  secondaryButton: {
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  buttonContent: {
    height: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  termsText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '500',
  },
});

export default WelcomeScreen;
