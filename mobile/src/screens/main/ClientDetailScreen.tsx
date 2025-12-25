/**
 * Client Detail Screen - View and manage a specific client
 */

import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, ScrollView, Alert, Linking} from 'react-native';
import {
  Card,
  Button,
  IconButton,
  Avatar,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {clientService, Client} from '../../services/api';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius, shadows} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'ClientDetail'>;
type ClientDetailRouteProp = RouteProp<MainStackParamList, 'ClientDetail'>;

const ClientDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ClientDetailRouteProp>();
  const {clientId} = route.params;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClient();
  }, [clientId]);

  const loadClient = async () => {
    try {
      const response = await clientService.getClientById(clientId);
      setClient(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load client');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Client',
      'Are you sure you want to delete this client? This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await clientService.deleteClient(clientId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete client');
            }
          },
        },
      ],
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!client) {
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
          <IconButton icon="pencil" size={22} onPress={() => {}} />
          <IconButton icon="delete" size={22} onPress={handleDelete} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Client Header */}
        <View style={styles.clientHeader}>
          <Avatar.Text
            size={80}
            label={getInitials(client.name)}
            style={styles.avatar}
          />
          <Text style={styles.clientName}>{client.name}</Text>
          {client.company && (
            <Text style={styles.clientCompany}>{client.company}</Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            mode="contained"
            icon="phone"
            onPress={handleCall}
            style={styles.actionButton}
            disabled={!client.phone}>
            Call
          </Button>
          <Button
            mode="contained"
            icon="email"
            onPress={handleEmail}
            style={styles.actionButton}>
            Email
          </Button>
        </View>

        {/* Contact Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Icon name="envelope" size={16} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{client.email}</Text>
              </View>
            </View>

            {client.phone && (
              <View style={styles.infoRow}>
                <Icon name="phone" size={16} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{client.phone}</Text>
                </View>
              </View>
            )}

            {client.address && (
              <View style={styles.infoRow}>
                <Icon name="map-marker-alt" size={16} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{client.address}</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Notes */}
        {client.notes && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Divider style={styles.divider} />
              <Text style={styles.notesText}>{client.notes}</Text>
            </Card.Content>
          </Card>
        )}

        {/* Activity */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Activity</Text>
            <Divider style={styles.divider} />
            <View style={styles.activityItem}>
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>Client added</Text>
                <Text style={styles.activityDate}>
                  {new Date(client.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Documents Button */}
        <Button
          mode="outlined"
          icon="file-document-multiple"
          onPress={() => {}}
          style={styles.documentsButton}
          contentStyle={styles.documentsButtonContent}>
          View Client Documents
        </Button>
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
  clientHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  clientName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  clientCompany: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
    borderRadius: borderRadius.md,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  infoContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    color: colors.text,
    marginTop: 2,
  },
  notesText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: colors.text,
  },
  activityDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  documentsButton: {
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  documentsButtonContent: {
    height: 48,
  },
});

export default ClientDetailScreen;
