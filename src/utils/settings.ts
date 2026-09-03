export interface AppSettings {
  profile: {
    displayName: string;
    phoneNumber: string;
    email: string;
    username: string;
  };
  schedule: {
    workDays: boolean[]; // 0=Mon, 1=Tue, etc.
    workStart: string; // e.g., "08:00"
    workEnd: string;   // e.g., "19:00"
  };
  breakTime: {
    breakStart: string;
    breakEnd: string;
  };
  packages: {
    sessionDuration: number;
    breakBetween: number;
    sessionPrice: number;
  };
  reminders: {
    reminderLastSession: boolean;
    whatsappTemplate: string;
  };
  categories: string[];
}

export const defaultSettings: AppSettings = {
  profile: {
    displayName: "Roxana Vieru",
    phoneNumber: "+40 722 000 111",
    email: "roxana.vieru@gmail.com",
    username: "@roxanavieru"
  },
  schedule: {
    workDays: [true, false, false, false, false], // Default Mon selected
    workStart: "08:00",
    workEnd: "19:00"
  },
  breakTime: {
    breakStart: "13:00",
    breakEnd: "14:00"
  },
  packages: {
    sessionDuration: 50,
    breakBetween: 10,
    sessionPrice: 150
  },
  reminders: {
    reminderLastSession: true,
    whatsappTemplate: "Salut {nume}! Îți reamintim că mai ai {ramase} ședințe rămase din pachetul tău Kineto. Te așteptăm cu drag!"
  },
  categories: ["Maria Popescu", "Andrei Ionescu", "Elena Stan", "Ion Vasile", "Kineto", "Masaj"]
};

const SETTINGS_KEY = 'kineto_app_settings';

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings;
  
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      // Deep merge for nested objects to ensure defaults remain if missing
      const parsed = JSON.parse(saved);
      return {
        profile: { ...defaultSettings.profile, ...(parsed.profile || {}) },
        schedule: { ...defaultSettings.schedule, ...(parsed.schedule || {}) },
        breakTime: { ...defaultSettings.breakTime, ...(parsed.breakTime || {}) },
        packages: { ...defaultSettings.packages, ...(parsed.packages || {}) },
        reminders: { ...defaultSettings.reminders, ...(parsed.reminders || {}) },
        categories: parsed.categories || defaultSettings.categories
      };
    }
  } catch (e) {
    console.error('Error loading settings', e);
  }
  return defaultSettings;
}

export function saveSettings(settings: Partial<AppSettings>) {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error saving settings', e);
  }
}
