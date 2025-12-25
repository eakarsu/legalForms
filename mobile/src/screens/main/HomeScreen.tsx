/**
 * Home Screen - Dashboard for authenticated users
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {Card} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {useAuthStore} from '../../store/authStore';
import {documentService, clientService} from '../../services/api';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius, shadows} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface QuickAction {
  icon: string;
  label: string;
  color: string;
  category: string;
}

const quickActions: QuickAction[] = [
  {icon: 'building', label: 'Business', color: '#667eea', category: 'business_formation'},
  {icon: 'home', label: 'Real Estate', color: '#10b981', category: 'real_estate'},
  {icon: 'users', label: 'Family Law', color: '#f59e0b', category: 'family_law'},
  {icon: 'scroll', label: 'Estate', color: '#8b5cf6', category: 'estate_planning'},
];

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    documents: 0,
    clients: 0,
    recentDocuments: [] as any[],
  });

  const loadData = async () => {
    try {
      const [docsRes, clientsRes] = await Promise.all([
        documentService.getMyDocuments({limit: 5}),
        clientService.getClients({limit: 1}),
      ]);
      setStats({
        documents: docsRes.data.total || 0,
        clients: clientsRes.data.total || 0,
        recentDocuments: docsRes.data.documents || [],
      });
    } catch (error) {
      console.log('Failed to load dashboard data');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}>
            <Icon name="cog" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, {backgroundColor: colors.primary}]}>
            <Icon name="file-alt" size={24} color={colors.textLight} />
            <Text style={styles.statNumber}>{stats.documents}</Text>
            <Text style={styles.statLabel}>Documents</Text>
          </View>
          <View style={[styles.statCard, {backgroundColor: colors.secondary}]}>
            <Icon name="users" size={24} color={colors.textLight} />
            <Text style={styles.statNumber}>{stats.clients}</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Create</Text>
          <View style={styles.quickActions}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionItem}
                onPress={() =>
                  navigation.navigate('DocumentForm', {category: action.category})
                }>
                <View
                  style={[
                    styles.quickActionIcon,
                    {backgroundColor: action.color + '15'},
                  ]}>
                  <Icon name={action.icon} size={20} color={action.color} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Documents</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('Tabs', {screen: 'DocumentsTab'} as any)
              }>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {stats.recentDocuments.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Icon name="file-alt" size={40} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Documents Yet</Text>
                <Text style={styles.emptyText}>
                  Create your first legal document to get started
                </Text>
              </Card.Content>
            </Card>
          ) : (
            stats.recentDocuments.map((doc, index) => (
              <TouchableOpacity
                key={index}
                onPress={() =>
                  navigation.navigate('DocumentDetail', {documentId: doc.id})
                }>
                <Card style={styles.documentCard}>
                  <Card.Content style={styles.documentContent}>
                    <View style={styles.documentIcon}>
                      <Icon name="file-contract" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentTitle}>{doc.title}</Text>
                      <Text style={styles.documentMeta}>
                        {doc.category} • {new Date(doc.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.textMuted} />
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Tips Section */}
        <Card style={styles.tipsCard}>
          <Card.Content>
            <View style={styles.tipsHeader}>
              <Icon name="lightbulb" size={20} color={colors.warning} solid />
              <Text style={styles.tipsTitle}>Pro Tip</Text>
            </View>
            <Text style={styles.tipsText}>
              Use AI-powered document analysis to review contracts and identify
              potential issues before signing.
            </Text>
          </Card.Content>
        </Card>
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
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textLight,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  seeAllText: {
    color: colors.primary,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  documentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  documentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  documentMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tipsCard: {
    backgroundColor: '#fef3c7',
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  tipsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default HomeScreen;
