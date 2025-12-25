# LegalPracticeAI Mobile App

A React Native mobile application for LegalPracticeAI - Generate professional legal documents with AI.

## Features

- 📄 **Document Generation**: Create 36+ types of legal documents
- 👥 **Client Management**: Manage clients and their documents
- 🤖 **AI-Powered**: Leverage AI for intelligent document generation
- 🔐 **Secure Authentication**: OAuth with Google and Microsoft
- 📱 **Native Experience**: Full native iOS and Android support
- 🌙 **Dark Mode**: System theme support
- 📴 **Offline Support**: Work offline with automatic sync

## Tech Stack

- **Framework**: React Native 0.73
- **Navigation**: React Navigation 6
- **UI Components**: React Native Paper (Material Design 3)
- **State Management**: Zustand
- **Forms**: Formik + Yup
- **HTTP Client**: Axios
- **Storage**: AsyncStorage

## Project Structure

```
mobile/
├── App.tsx                 # App entry point
├── src/
│   ├── components/         # Reusable components
│   ├── hooks/              # Custom React hooks
│   ├── navigation/         # Navigation configuration
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── screens/            # Screen components
│   │   ├── auth/           # Authentication screens
│   │   └── main/           # Main app screens
│   ├── services/           # API and external services
│   │   └── api.ts
│   ├── store/              # State management
│   │   ├── authStore.ts
│   │   └── themeStore.ts
│   └── utils/              # Utility functions
│       └── theme.ts
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 18
- React Native CLI
- Xcode (for iOS)
- Android Studio (for Android)

### Installation

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Install iOS pods
cd ios && pod install && cd ..
```

### Running the App

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Configuration

Create a `.env` file in the mobile directory:

```
API_URL=http://localhost:3000/api
```

For production, update to your production API URL.

## Screens

### Authentication
- **Welcome**: Onboarding screen with app features
- **Login**: Email/password and OAuth login
- **Register**: New account registration
- **Forgot Password**: Password recovery

### Main App
- **Home**: Dashboard with stats and quick actions
- **Documents**: List of generated documents
- **Create**: Document category and template selection
- **Clients**: Client list and management
- **Profile**: User settings and preferences

### Detail Screens
- **Document Detail**: View, share, and download documents
- **Document Form**: Fill out document details
- **Client Detail**: View and manage client info
- **Settings**: App preferences and account settings

## API Integration

The app connects to the LegalPracticeAI backend API for:
- User authentication
- Document generation and management
- Client CRUD operations
- AI-powered features

See `src/services/api.ts` for API implementation.

## Building for Production

### iOS
```bash
cd ios
xcodebuild -workspace LegalPracticeAI.xcworkspace -scheme LegalPracticeAI -configuration Release
```

### Android
```bash
cd android
./gradlew assembleRelease
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test on both iOS and Android
4. Submit a pull request

## License

Proprietary - LegalPracticeAI
