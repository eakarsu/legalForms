/**
 * Documents Screen - List of user's generated documents
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {Searchbar, Chip, Card, Menu, IconButton} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {documentService, GeneratedDocument} from '../../services/api';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius, shadows} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const categories = [
  {key: 'all', label: 'All'},
  {key: 'business_formation', label: 'Business'},
  {key: 'real_estate', label: 'Real Estate'},
  {key: 'family_law', label: 'Family Law'},
  {key: 'estate_planning', label: 'Estate'},
];

const DocumentsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const params: any = {limit: 50};
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      const response = await documentService.getMyDocuments(params);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.log('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDelete = async (documentId: string) => {
    try {
      await documentService.deleteDocument(documentId);
      setDocuments(docs => docs.filter(d => d.id !== documentId));
    } catch (error) {
      console.log('Failed to delete document');
    }
    setMenuVisible(null);
  };

  const renderDocument = ({item}: {item: GeneratedDocument}) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('DocumentDetail', {documentId: item.id})}>
      <Card style={styles.documentCard}>
        <Card.Content style={styles.documentContent}>
          <View style={styles.documentIcon}>
            <Icon name="file-contract" size={22} color={colors.primary} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.documentMeta}>
              {item.category.replace('_', ' ')} •{' '}
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <View style={styles.statusBadge}>
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.status === 'final'
                        ? colors.success
                        : item.status === 'signed'
                        ? colors.primary
                        : colors.warning,
                  },
                ]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Menu
            visible={menuVisible === item.id}
            onDismiss={() => setMenuVisible(null)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={20}
                onPress={() => setMenuVisible(item.id)}
              />
            }>
            <Menu.Item
              onPress={() => {
                setMenuVisible(null);
                navigation.navigate('DocumentDetail', {documentId: item.id});
              }}
              title="View"
              leadingIcon="eye"
            />
            <Menu.Item
              onPress={() => handleDelete(item.id)}
              title="Delete"
              leadingIcon="delete"
              titleStyle={{color: colors.error}}
            />
          </Menu>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="folder-open" size={60} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Documents Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try a different search term'
          : 'Create your first document to get started'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Documents</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search documents..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />
      </View>

      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={item => item.key}
          renderItem={({item}) => (
            <Chip
              selected={selectedCategory === item.key}
              onPress={() => setSelectedCategory(item.key)}
              style={[
                styles.chip,
                selectedCategory === item.key && styles.chipSelected,
              ]}
              textStyle={[
                styles.chipText,
                selectedCategory === item.key && styles.chipTextSelected,
              ]}>
              {item.label}
            </Chip>
          )}
          contentContainerStyle={styles.chipList}
        />
      </View>

      {/* Documents List */}
      <FlatList
        data={filteredDocuments}
        renderItem={renderDocument}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmpty}
      />
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
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchBar: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    elevation: 0,
  },
  searchInput: {
    fontSize: 15,
  },
  filterContainer: {
    marginBottom: spacing.md,
  },
  chipList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textLight,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: 0,
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
    width: 48,
    height: 48,
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
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  documentMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default DocumentsScreen;
