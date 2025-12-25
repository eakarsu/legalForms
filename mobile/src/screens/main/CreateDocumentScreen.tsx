/**
 * Create Document Screen - Select document category and template
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {Card} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius, shadows} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  templates: string[];
}

const documentCategories: DocumentCategory[] = [
  {
    id: 'business_formation',
    name: 'Business Formation',
    description: 'LLC, corporations, partnerships, and more',
    icon: 'building',
    color: '#667eea',
    templates: ['LLC Operating Agreement', 'Articles of Incorporation', 'Partnership Agreement'],
  },
  {
    id: 'real_estate',
    name: 'Real Estate',
    description: 'Purchase agreements, leases, deeds',
    icon: 'home',
    color: '#10b981',
    templates: ['Purchase Agreement', 'Lease Agreement', 'Quitclaim Deed'],
  },
  {
    id: 'family_law',
    name: 'Family Law',
    description: 'Divorce, custody, prenuptial agreements',
    icon: 'users',
    color: '#f59e0b',
    templates: ['Divorce Petition', 'Child Custody Agreement', 'Prenuptial Agreement'],
  },
  {
    id: 'estate_planning',
    name: 'Estate Planning',
    description: 'Wills, trusts, power of attorney',
    icon: 'scroll',
    color: '#8b5cf6',
    templates: ['Last Will and Testament', 'Living Trust', 'Power of Attorney'],
  },
  {
    id: 'employment',
    name: 'Employment',
    description: 'Contracts, NDAs, non-competes',
    icon: 'briefcase',
    color: '#ec4899',
    templates: ['Employment Contract', 'NDA', 'Non-Compete Agreement'],
  },
  {
    id: 'civil_litigation',
    name: 'Civil Litigation',
    description: 'Complaints, motions, discovery',
    icon: 'gavel',
    color: '#06b6d4',
    templates: ['Complaint', 'Motion to Dismiss', 'Interrogatories'],
  },
];

const CreateDocumentScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Create Document</Text>
          <Text style={styles.headerSubtitle}>
            Select a category to get started
          </Text>
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {documentCategories.map(category => (
          <TouchableOpacity
            key={category.id}
            onPress={() =>
              navigation.navigate('DocumentForm', {category: category.id})
            }>
            <Card style={styles.categoryCard}>
              <Card.Content style={styles.categoryContent}>
                <View
                  style={[
                    styles.categoryIcon,
                    {backgroundColor: category.color + '15'},
                  ]}>
                  <Icon
                    name={category.icon}
                    size={24}
                    color={category.color}
                  />
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryDescription}>
                    {category.description}
                  </Text>
                  <View style={styles.templateTags}>
                    {category.templates.slice(0, 2).map((template, index) => (
                      <View key={index} style={styles.templateTag}>
                        <Text style={styles.templateTagText}>{template}</Text>
                      </View>
                    ))}
                    {category.templates.length > 2 && (
                      <Text style={styles.moreText}>
                        +{category.templates.length - 2} more
                      </Text>
                    )}
                  </View>
                </View>
                <Icon
                  name="chevron-right"
                  size={16}
                  color={colors.textMuted}
                />
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}

        {/* AI Suggestion Card */}
        <Card style={styles.aiCard}>
          <Card.Content style={styles.aiContent}>
            <View style={styles.aiIcon}>
              <Icon name="robot" size={24} color={colors.primary} />
            </View>
            <View style={styles.aiInfo}>
              <Text style={styles.aiTitle}>Need Help Choosing?</Text>
              <Text style={styles.aiDescription}>
                Describe what you need and our AI will suggest the right
                document template for you.
              </Text>
            </View>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.xxl,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  categoryDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  templateTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  templateTag: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  templateTagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  moreText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  aiCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginTop: spacing.md,
  },
  aiContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  aiInfo: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  aiDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
});

export default CreateDocumentScreen;
