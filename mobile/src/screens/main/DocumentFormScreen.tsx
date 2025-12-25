/**
 * Document Form Screen - Form to create a new document
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  HelperText,
  SegmentedButtons,
  ActivityIndicator,
} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome5';

import {documentService, DocumentTemplate} from '../../services/api';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {colors, spacing, borderRadius} from '../../utils/theme';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'DocumentForm'>;
type DocumentFormRouteProp = RouteProp<MainStackParamList, 'DocumentForm'>;

// US States for jurisdiction
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
];

const DocumentFormScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DocumentFormRouteProp>();
  const {category} = route.params;

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [formData, setFormData] = useState<Record<string, string>>({
    state: 'California',
  });

  useEffect(() => {
    loadTemplates();
  }, [category]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await documentService.getTemplates(category);
      setTemplates(response.data.templates || []);
      if (response.data.templates?.length > 0) {
        setSelectedTemplate(response.data.templates[0].id);
      }
    } catch (error) {
      // Use fallback templates
      setTemplates([
        {id: '1', name: 'Standard Template', category, description: 'Default template', fields: []},
      ]);
      setSelectedTemplate('1');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      Alert.alert('Error', 'Please select a template');
      return;
    }

    setGenerating(true);
    try {
      const response = await documentService.generateDocument(selectedTemplate, formData);
      Alert.alert('Success', 'Document generated successfully!', [
        {
          text: 'View Document',
          onPress: () =>
            navigation.navigate('DocumentDetail', {documentId: response.data.id}),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate document. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const getCategoryTitle = () => {
    const titles: Record<string, string> = {
      business_formation: 'Business Formation',
      real_estate: 'Real Estate',
      family_law: 'Family Law',
      estate_planning: 'Estate Planning',
      employment: 'Employment',
      civil_litigation: 'Civil Litigation',
    };
    return titles[category] || 'Document';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading templates...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        {/* Header */}
        <View style={styles.header}>
          <Button
            mode="text"
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            textColor={colors.text}>
            Back
          </Button>
          <Text style={styles.headerTitle}>{getCategoryTitle()}</Text>
          <View style={{width: 60}} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* Template Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Template</Text>
            <View style={styles.templateList}>
              {templates.map(template => (
                <Button
                  key={template.id}
                  mode={selectedTemplate === template.id ? 'contained' : 'outlined'}
                  onPress={() => setSelectedTemplate(template.id)}
                  style={styles.templateButton}
                  contentStyle={styles.templateButtonContent}>
                  {template.name}
                </Button>
              ))}
            </View>
          </View>

          {/* State Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Jurisdiction</Text>
            <TextInput
              mode="outlined"
              label="State"
              value={formData.state}
              onChangeText={text => setFormData({...formData, state: text})}
              right={<TextInput.Icon icon="chevron-down" />}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
            <HelperText type="info">
              Select the state where this document will be used
            </HelperText>
          </View>

          {/* Common Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Document Details</Text>

            <TextInput
              mode="outlined"
              label="Full Legal Name"
              value={formData.fullName || ''}
              onChangeText={text => setFormData({...formData, fullName: text})}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              mode="outlined"
              label="Address"
              value={formData.address || ''}
              onChangeText={text => setFormData({...formData, address: text})}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              mode="outlined"
              label="City"
              value={formData.city || ''}
              onChangeText={text => setFormData({...formData, city: text})}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="State"
                value={formData.stateAddress || ''}
                onChangeText={text => setFormData({...formData, stateAddress: text})}
                style={[styles.input, styles.halfInput]}
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                mode="outlined"
                label="ZIP Code"
                value={formData.zip || ''}
                onChangeText={text => setFormData({...formData, zip: text})}
                keyboardType="numeric"
                style={[styles.input, styles.halfInput]}
                outlineStyle={styles.inputOutline}
              />
            </View>

            <TextInput
              mode="outlined"
              label="Additional Details"
              value={formData.details || ''}
              onChangeText={text => setFormData({...formData, details: text})}
              multiline
              numberOfLines={4}
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />
          </View>

          {/* AI Enhancement Info */}
          <View style={styles.aiInfoBox}>
            <Icon name="robot" size={20} color={colors.primary} />
            <Text style={styles.aiInfoText}>
              Our AI will generate a professionally formatted legal document
              based on your inputs, compliant with {formData.state || 'your state'}'s laws.
            </Text>
          </View>
        </ScrollView>

        {/* Generate Button */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleGenerate}
            loading={generating}
            disabled={generating}
            style={styles.generateButton}
            contentStyle={styles.generateButtonContent}
            labelStyle={styles.generateButtonLabel}>
            {generating ? 'Generating...' : 'Generate Document'}
          </Button>
        </View>
      </KeyboardAvoidingView>
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
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  keyboardView: {
    flex: 1,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  templateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  templateButton: {
    borderRadius: borderRadius.md,
  },
  templateButtonContent: {
    height: 40,
  },
  input: {
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  inputOutline: {
    borderRadius: borderRadius.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  aiInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  aiInfoText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  generateButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  generateButtonContent: {
    height: 52,
  },
  generateButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DocumentFormScreen;
