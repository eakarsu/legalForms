/**
 * API Service Layer for LegalPracticeAI Mobile
 * Handles all HTTP requests to the backend server
 */

import axios, {AxiosInstance, AxiosError} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Configuration
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.legalpracticeai.com/api';

const TIMEOUT = 30000;

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

// Response interceptor - handle errors
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired, clear auth
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  },
);

// Check network connectivity
export const checkConnectivity = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

// ========== Auth Services ==========

export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', {email, password}),

  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', {name, email, password}),

  logout: () => api.post('/auth/logout'),

  verifyToken: () => api.get('/auth/verify'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', {email}),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', {token, password}),

  updateProfile: (data: {name?: string; email?: string; avatar?: string}) =>
    api.put('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', {currentPassword, newPassword}),
};

// ========== Document Services ==========

export interface DocumentTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  fields: DocumentField[];
}

export interface DocumentField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface GeneratedDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'final' | 'signed';
}

export const documentService = {
  getCategories: () => api.get('/documents/categories'),

  getTemplates: (category?: string) =>
    api.get('/documents/templates', {params: {category}}),

  getTemplateById: (templateId: string) =>
    api.get(`/documents/templates/${templateId}`),

  generateDocument: (templateId: string, formData: Record<string, any>) =>
    api.post('/documents/generate', {templateId, formData}),

  getMyDocuments: (params?: {page?: number; limit?: number; category?: string}) =>
    api.get('/documents/history', {params}),

  getDocumentById: (documentId: string) =>
    api.get(`/documents/${documentId}`),

  updateDocument: (documentId: string, data: Partial<GeneratedDocument>) =>
    api.put(`/documents/${documentId}`, data),

  deleteDocument: (documentId: string) =>
    api.delete(`/documents/${documentId}`),

  downloadDocument: (documentId: string, format: 'pdf' | 'docx') =>
    api.get(`/documents/${documentId}/download`, {
      params: {format},
      responseType: 'blob',
    }),

  shareDocument: (documentId: string, email: string) =>
    api.post(`/documents/${documentId}/share`, {email}),
};

// ========== Client Services ==========

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export const clientService = {
  getClients: (params?: {page?: number; limit?: number; search?: string}) =>
    api.get('/clients', {params}),

  getClientById: (clientId: string) =>
    api.get(`/clients/${clientId}`),

  createClient: (data: Omit<Client, 'id' | 'createdAt'>) =>
    api.post('/clients', data),

  updateClient: (clientId: string, data: Partial<Client>) =>
    api.put(`/clients/${clientId}`, data),

  deleteClient: (clientId: string) =>
    api.delete(`/clients/${clientId}`),

  getClientDocuments: (clientId: string) =>
    api.get(`/clients/${clientId}/documents`),
};

// ========== Case Services ==========

export interface Case {
  id: string;
  title: string;
  clientId: string;
  status: 'active' | 'pending' | 'closed';
  type: string;
  description?: string;
  createdAt: string;
}

export const caseService = {
  getCases: (params?: {page?: number; limit?: number; status?: string}) =>
    api.get('/cases', {params}),

  getCaseById: (caseId: string) =>
    api.get(`/cases/${caseId}`),

  createCase: (data: Omit<Case, 'id' | 'createdAt'>) =>
    api.post('/cases', data),

  updateCase: (caseId: string, data: Partial<Case>) =>
    api.put(`/cases/${caseId}`, data),

  deleteCase: (caseId: string) =>
    api.delete(`/cases/${caseId}`),
};

// ========== AI Services ==========

export const aiService = {
  analyzeContract: (documentId: string) =>
    api.post('/ai/analyze-contract', {documentId}),

  summarizeDocument: (documentId: string) =>
    api.post('/ai/summarize', {documentId}),

  suggestClauses: (context: string) =>
    api.post('/ai/suggest-clauses', {context}),

  predictOutcome: (caseData: Record<string, any>) =>
    api.post('/ai/predict-outcome', {caseData}),
};

// ========== Billing Services ==========

export const billingService = {
  getSubscription: () => api.get('/billing/subscription'),

  getPlans: () => api.get('/billing/plans'),

  createCheckoutSession: (planId: string) =>
    api.post('/billing/checkout', {planId}),

  cancelSubscription: () => api.post('/billing/cancel'),

  getInvoices: () => api.get('/billing/invoices'),
};

export default api;
