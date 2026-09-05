'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface SchoolSettings {
  graduation_point: string | number | readonly string[] | undefined;
  id: number;
  school_name: string;
  school_code: string;
  school_logo?: string;
  dark_mode: boolean;
  primary_color: string;

  // Dashboard Widgets
  show_student_stats: boolean;
  show_teacher_stats: boolean;
  show_alumni_stats: boolean;
  show_attendance_widget: boolean;
  show_finance_widget: boolean;
  show_health_widget: boolean;
  show_gatepass_widget: boolean;
  show_achievements_widget: boolean;
  show_transfers_widget: boolean;
  // Gatepass
  enable_gatepass_print: boolean;
  gatepass_sender_email: string;
  gatepass_app_password: string;
  gatepass_verification_base_url: string;
  gatepass_creation_email_body?: string;
  gatepass_departure_email_body?: string;

  // Notifications
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;

  // Academic
  academic_year_start_month?: number;
  academic_year_start_day?: number;
  academic_year_end_month?: number;
  academic_year_end_day?: number;
  current_academic_year?: string;
  available_academic_years?: string[];
  academic_year_format: string;
  allow_continuation_after_10: boolean;


  // Privacy
  show_student_photos: boolean;
  show_parent_contact: boolean;
  show_financial_data: boolean;

  // System
  default_language: string;
  timezone: string;
  date_format: string;

  // Finance Settings
  prevent_duplicate_billing: boolean;
  require_billing_confirmation: boolean;
  show_student_fee_history_on_invoice: boolean;
  auto_generate_installment_invoices: boolean;
  days_before_due_to_generate: number;
  auto_apply_late_fee: boolean;
  show_fee_breakdown_on_invoice: boolean;
  send_payment_reminders: boolean;
  reminder_days_before_due: number;
  school_address: string;
  school_latitude: number;
  school_longitude: number;

  updated_at: string;
}

interface SettingsContextType {
  settings: SchoolSettings | null;
  loading: boolean;
  updateSettings: (data: Partial<SchoolSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  formatAcademicYear: (year: string | null | undefined) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Monkey-patch Date.prototype.toLocaleDateString globally on the client side
if (typeof window !== 'undefined') {
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (
    this: Date,
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions
  ) {
    if (options && (options.month === 'long' || options.month === 'short') && !options.day) {
      return originalToLocaleDateString.call(this, locales, options);
    }

    const format = (window as any).__schoolDateFormat || localStorage.getItem('school_date_format') || 'DD/MM/YYYY';
    const day = String(this.getDate()).padStart(2, '0');
    const month = String(this.getMonth() + 1).padStart(2, '0');
    const year = this.getFullYear();

    if (format === 'MM/DD/YYYY') {
      return `${month}/${day}/${year}`;
    } else if (format === 'YYYY-MM-DD') {
      return `${year}-${month}-${day}`;
    } else {
      return `${day}/${month}/${year}`;
    }
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const userStr = localStorage.getItem('user');

      // Skip fetching settings for platform admins (they don't have a school)
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.user_type === 'PLATFORM_ADMIN') {
          setLoading(false);
          return;
        }
      }

      const response = await axios.get('http://localhost:8000/api/v1/schools/settings/my_settings/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (data: Partial<SchoolSettings>) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.patch(
        'http://localhost:8000/api/v1/schools/settings/update_my_settings/',
        data,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSettings(response.data);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };

  const formatAcademicYear = (year: string | null | undefined): string => {
    if (!year) return '';
    const format = settings?.academic_year_format || localStorage.getItem('school_academic_year_format') || 'YYYY-YYYY';
    
    const match = year.match(/(\d{4})[-/](\d{4})/);
    let startYear = '';
    let endYear = '';
    if (match) {
      startYear = match[1];
      endYear = match[2];
    } else {
      const yyMatch = year.match(/(\d{2})[-/](\d{2})/);
      if (yyMatch) {
        startYear = '20' + yyMatch[1];
        endYear = '20' + yyMatch[2];
      } else {
        const singleMatch = year.match(/(\d{4})/);
        if (singleMatch) {
          startYear = singleMatch[1];
          endYear = String(parseInt(startYear) + 1);
        } else {
          return year;
        }
      }
    }

    if (format === 'YYYY/YYYY') {
      return `${startYear}/${endYear}`;
    } else if (format === 'YY-YY') {
      return `${startYear.slice(2)}-${endYear.slice(2)}`;
    } else {
      return `${startYear}-${endYear}`;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && settings) {
      (window as any).__schoolDateFormat = settings.date_format;
      (window as any).__schoolAcademicYearFormat = settings.academic_year_format;
      localStorage.setItem('school_date_format', settings.date_format);
      localStorage.setItem('school_academic_year_format', settings.academic_year_format);
    }
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        refreshSettings: fetchSettings,
        formatAcademicYear,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
