/**
 * Main Navigator - Bottom tab navigation for authenticated users
 */

import React from 'react';
import {StyleSheet, View, TouchableOpacity} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';

import {colors, spacing} from '../utils/theme';

// Screens
import HomeScreen from '../screens/main/HomeScreen';
import DocumentsScreen from '../screens/main/DocumentsScreen';
import CreateDocumentScreen from '../screens/main/CreateDocumentScreen';
import ClientsScreen from '../screens/main/ClientsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import DocumentDetailScreen from '../screens/main/DocumentDetailScreen';
import DocumentFormScreen from '../screens/main/DocumentFormScreen';
import ClientDetailScreen from '../screens/main/ClientDetailScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

export type MainTabParamList = {
  HomeTab: undefined;
  DocumentsTab: undefined;
  CreateTab: undefined;
  ClientsTab: undefined;
  ProfileTab: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  DocumentDetail: {documentId: string};
  DocumentForm: {category: string; templateId?: string};
  ClientDetail: {clientId: string};
  Settings: undefined;
  CreateDocument: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

// Custom center button component
interface CreateButtonProps {
  onPress: () => void;
}

const CreateButton: React.FC<CreateButtonProps> = ({onPress}) => (
  <TouchableOpacity style={styles.createButton} onPress={onPress}>
    <View style={styles.createButtonInner}>
      <Icon name="plus" size={24} color={colors.textLight} />
    </View>
  </TouchableOpacity>
);

// Tab navigator
const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'HomeTab':
              iconName = 'home';
              break;
            case 'DocumentsTab':
              iconName = 'file-alt';
              break;
            case 'CreateTab':
              iconName = 'plus';
              break;
            case 'ClientsTab':
              iconName = 'users';
              break;
            case 'ProfileTab':
              iconName = 'user';
              break;
            default:
              iconName = 'circle';
          }

          return (
            <Icon
              name={iconName}
              size={route.name === 'CreateTab' ? 0 : 20}
              color={color}
              solid={focused}
            />
          );
        },
      })}>
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{tabBarLabel: 'Home'}}
      />
      <Tab.Screen
        name="DocumentsTab"
        component={DocumentsScreen}
        options={{tabBarLabel: 'Documents'}}
      />
      <Tab.Screen
        name="CreateTab"
        component={CreateDocumentScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: props => (
            <CreateButton onPress={() => props.onPress?.(undefined as any)} />
          ),
        }}
      />
      <Tab.Screen
        name="ClientsTab"
        component={ClientsScreen}
        options={{tabBarLabel: 'Clients'}}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{tabBarLabel: 'Profile'}}
      />
    </Tab.Navigator>
  );
};

// Main stack navigator
const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="DocumentDetail"
        component={DocumentDetailScreen}
        options={{animation: 'slide_from_bottom'}}
      />
      <Stack.Screen
        name="DocumentForm"
        component={DocumentFormScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="ClientDetail"
        component={ClientDetailScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="CreateDocument"
        component={CreateDocumentScreen}
        options={{
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    height: 70,
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  createButton: {
    position: 'relative',
    bottom: 15,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MainNavigator;
