/**
 * Centralized Application Constants & Navigation Items
 */

// Timing Thresholds
export const NOTIFICATION_LEAD_TIME_MS = 10 * 60 * 1000; // 10 minutes prior to appointment
export const DEFAULT_SESSION_DURATION_MS = 50 * 60 * 1000; // 50 minutes standard therapy session

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  AGENDA: '/dashboard/calendar',
  PATIENTS: '/dashboard/patients',
  REPORTS: '/dashboard/reports',
  SETTINGS: '/dashboard/settings',
} as const;

export interface NavItem {
  name: string;
  path: string;
  iconName: 'home' | 'calendar' | 'patients' | 'reports' | 'settings';
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', path: ROUTES.DASHBOARD, iconName: 'home' },
  { name: 'Agenda', path: ROUTES.AGENDA, iconName: 'calendar' },
  { name: 'Patients', path: ROUTES.PATIENTS, iconName: 'patients' },
  { name: 'Reports', path: ROUTES.REPORTS, iconName: 'reports' },
  { name: 'Settings', path: ROUTES.SETTINGS, iconName: 'settings' },
];

// App Configuration & Service Worker
export const SW_SCOPE = '/';
export const SW_SCRIPT_URL = '/sw.js';

// Local Storage Keys
export const STORAGE_KEYS = {
  PUSH_SUBSCRIPTION: 'kineto_push_subscription',
  THEME_MODE: 'kineto_theme_mode',
} as const;
