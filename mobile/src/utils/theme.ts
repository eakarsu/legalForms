/**
 * Theme configuration for LegalPracticeAI Mobile
 */

export const colors = {
  // Primary brand colors
  primary: '#667eea',
  primaryDark: '#5a6fd6',
  secondary: '#764ba2',

  // UI colors
  background: '#f8f9fa',
  surface: '#ffffff',
  surfaceVariant: '#f0f0f0',

  // Text colors
  text: '#2c3e50',
  textSecondary: '#6c757d',
  textLight: '#ffffff',
  textMuted: '#adb5bd',

  // Status colors
  success: '#198754',
  warning: '#ffc107',
  error: '#dc3545',
  info: '#0dcaf0',

  // Border colors
  border: '#dee2e6',
  borderLight: '#f0f0f0',

  // Gradient colors
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};
