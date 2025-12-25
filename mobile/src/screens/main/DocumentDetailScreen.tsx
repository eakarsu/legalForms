/**
 * Document Detail Screen - View and manage a specific document
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, ScrollView, Share, Alert} from 'react-native';
import {Button, Card, Chip, IconButton, ActivityIndicator} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {documentService, GeneratedDocument} from '../../services/api';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius, shadows} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'DocumentDetail'>;
type DocumentDetailRouteProp = RouteProp<MainStackParamList, 'DocumentDetail'>;

const DocumentDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DocumentDetailRouteProp>();
  const {documentId} = route.params;

  const [document, setDocument] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      const response = await documentService.getDocumentById(documentId);
      setDocument(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load document');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!document) return;
    try {
      await Share.share({
        message: `Check out this document: ${document.title}`,
        title: document.title,
      });
    } catch (error) {
      console.log('Share failed');
    }
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    Alert.alert('Download', `Downloading as ${format.toUpperCase()}...`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await documentService.deleteDocument(documentId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerActions}>
          <IconButton icon="share-variant" size={22} onPress={handleShare} />
          <IconButton icon="delete" size={22} onPress={handleDelete} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Document Info */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{document.title}</Text>
          <View style={styles.metaRow}>
            <Chip
              style={[
                styles.statusChip,
                {
                  backgroundColor:
                    document.status === 'final'
                      ? colors.success + '20'
                      : colors.warning + '20',
                },
              ]}
              textStyle={{
                color:
                  document.status === 'final' ? colors.success : colors.warning,
              }}>
              {document.status.toUpperCase()}
            </Chip>
            <Text style={styles.dateText}>
              Created {new Date(document.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Document Content Preview */}
        <Card style={styles.previewCard}>
          <Card.Content>
            <Text style={styles.previewTitle}>Document Preview</Text>
            <View style={styles.previewContent}>
              <Text style={styles.previewText} numberOfLines={20}>
                {document.content}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="download"
            onPress={() => handleDownload('pdf')}
            style={styles.actionButton}
            contentStyle={styles.buttonContent}>
            Download PDF
          </Button>
          <Button
            mode="outlined"
            icon="file-word"
            onPress={() => handleDownload('docx')}
            style={styles.actionButton}
            contentStyle={styles.buttonContent}>
            Download Word
          </Button>
        </View>

        {/* E-Signature Section */}
        <Card style={styles.signatureCard}>
          <Card.Content style={styles.signatureContent}>
            <Icon name="signature" size={24} color={colors.primary} />
            <View style={styles.signatureInfo}>
              <Text style={styles.signatureTitle}>Need Signatures?</Text>
              <Text style={styles.signatureText}>
                Send this document for electronic signature via DocuSign
              </Text>
            </View>
            <Button mode="text" compact>
              Send
            </Button>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  infoSection: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusChip: {
    marginRight: spacing.sm,
  },
  dateText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  previewContent: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    maxHeight: 300,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
    fontFamily: 'monospace',
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionButton: {
    borderRadius: borderRadius.md,
  },
  buttonContent: {
    height: 48,
  },
  signatureCard: {
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  signatureContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signatureInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  signatureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  signatureText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

export default DocumentDetailScreen;
