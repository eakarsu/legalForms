/**
 * Profile Screen - User profile and settings
 */

import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity} from 'react-native';
import {Avatar, Card, Divider, Switch} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useAuthStore} from '../../store/authStore';
import {useThemeStore} from '../../store/themeStore';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius, shadows} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface MenuItem {
  icon: string;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {user, logout} = useAuthStore();
  const {isDarkMode, toggleTheme} = useThemeStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const menuSections: {title: string; items: MenuItem[]}[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'user-edit',
          label: 'Edit Profile',
          onPress: () => navigation.navigate('Settings'),
        },
        {
          icon: 'lock',
          label: 'Change Password',
          onPress: () => console.log('Change password'),
        },
        {
          icon: 'shield-alt',
          label: 'Two-Factor Authentication',
          onPress: () => console.log('2FA'),
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: 'moon',
          label: 'Dark Mode',
          rightElement: (
            <Switch value={isDarkMode} onValueChange={toggleTheme} />
          ),
        },
        {
          icon: 'bell',
          label: 'Notifications',
          onPress: () => console.log('Notifications'),
        },
        {
          icon: 'globe',
          label: 'Language',
          onPress: () => console.log('Language'),
        },
      ],
    },
    {
      title: 'Subscription',
      items: [
        {
          icon: 'crown',
          label: 'Upgrade to Pro',
          onPress: () => console.log('Upgrade'),
        },
        {
          icon: 'receipt',
          label: 'Billing History',
          onPress: () => console.log('Billing'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'question-circle',
          label: 'Help Center',
          onPress: () => console.log('Help'),
        },
        {
          icon: 'envelope',
          label: 'Contact Support',
          onPress: () => console.log('Contact'),
        },
        {
          icon: 'file-alt',
          label: 'Terms of Service',
          onPress: () => console.log('Terms'),
        },
        {
          icon: 'user-secret',
          label: 'Privacy Policy',
          onPress: () => console.log('Privacy'),
        },
      ],
    },
    {
      title: '',
      items: [
        {
          icon: 'sign-out-alt',
          label: 'Sign Out',
          onPress: logout,
          danger: true,
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar.Text
            size={80}
            label={getInitials(user?.name || 'U')}
            style={styles.avatar}
          />
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.planBadge}>
            <Icon name="star" size={12} color={colors.warning} solid />
            <Text style={styles.planText}>
              {user?.subscription === 'pro' ? 'Pro' : 'Free'} Plan
            </Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            {section.title && (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            <Card style={styles.menuCard}>
              {section.items.map((item, itemIndex) => (
                <React.Fragment key={itemIndex}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={item.onPress}
                    disabled={!item.onPress && !item.rightElement}>
                    <View
                      style={[
                        styles.menuIcon,
                        item.danger && styles.menuIconDanger,
                      ]}>
                      <Icon
                        name={item.icon}
                        size={16}
                        color={item.danger ? colors.error : colors.primary}
                      />
                    </View>
                    <Text
                      style={[
                        styles.menuLabel,
                        item.danger && styles.menuLabelDanger,
                      ]}>
                      {item.label}
                    </Text>
                    {item.rightElement || (
                      <Icon
                        name="chevron-right"
                        size={14}
                        color={colors.textMuted}
                      />
                    )}
                  </TouchableOpacity>
                  {itemIndex < section.items.length - 1 && (
                    <Divider style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </Card>
          </View>
        ))}

        {/* App Version */}
        <Text style={styles.version}>LegalPracticeAI v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 70,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
    marginLeft: 6,
  },
  section: {
    marginBottom: spacing.lg,
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
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuIconDanger: {
    backgroundColor: colors.error + '15',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  menuLabelDanger: {
    color: colors.error,
  },
  divider: {
    marginLeft: 56,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});

export default ProfileScreen;
