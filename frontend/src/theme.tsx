/**
 * @file frontend/src/theme.tsx
 * @description Theme Context and dynamic CSS variable injector.
 * Fetches Super Admin custom visual style tokens from database and applies them to root element.
 * 
 * Connected Modules:
 * - frontend/src/main.tsx (wraps app in ThemeProvider)
 * - frontend/src/pages/super-admin.tsx (submits theme modifications)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeConfig, BrandingConfig } from '@workspace/shared';

interface ThemeContextType {
  theme: ThemeConfig;
  branding: BrandingConfig;
  updateTheme: (newTheme: Partial<ThemeConfig>) => void;
  updateBranding: (newBranding: Partial<BrandingConfig>) => void;
  loadBrandingAndTheme: () => Promise<void>;
}

const defaultTheme: ThemeConfig = {
  primaryAccent: '#00F0FF',
  bgVoid: '#0B0E14',
  cardSurface: '#121721',
  successColor: '#00E676',
  errorColor: '#FF1744',
  warningColor: '#FFD600',
  fontFamily: 'Inter',
  borderRadius: '8px',
  glassOpacity: 0.8,
};

const defaultBranding: BrandingConfig = {
  siteTitle: 'BRP Trade Router SaaS',
  logoUrl: '/assets/logo.svg',
  faviconUrl: '/favicon.ico',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(defaultTheme);
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);

  // Load custom configurations from backend API
  const loadBrandingAndTheme = async () => {
    try {
      const res = await fetch('/api/public/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.themeConfig) setTheme(data.themeConfig);
        if (data.brandingConfig) setBranding(data.brandingConfig);
      }
    } catch (err) {
      console.warn('[THEME_LOAD_WARNING] Could not load customized branding settings, running defaults', err);
    }
  };

  useEffect(() => {
    loadBrandingAndTheme();
  }, []);

  // Update root element CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-cyan', theme.primaryAccent);
    root.style.setProperty('--accent-green', theme.successColor);
    root.style.setProperty('--accent-red', theme.errorColor);
    root.style.setProperty('--accent-gold', theme.warningColor);
    root.style.setProperty('--bg-void', theme.bgVoid);
    root.style.setProperty('--bg-card', theme.cardSurface);
    root.style.setProperty('--border-radius', theme.borderRadius);
    root.style.setProperty('--glass-opacity', String(theme.glassOpacity));
    root.style.setProperty('font-family', theme.fontFamily);
    
    // Set site document title
    document.title = branding.siteTitle;
  }, [theme, branding]);

  const updateTheme = (newTheme: Partial<ThemeConfig>) => {
    setTheme((prev: ThemeConfig) => ({ ...prev, ...newTheme }));
  };

  const updateBranding = (newBranding: Partial<BrandingConfig>) => {
    setBranding((prev: BrandingConfig) => ({ ...prev, ...newBranding }));
  };

  return (
    <ThemeContext.Provider value={{ theme, branding, updateTheme, updateBranding, loadBrandingAndTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be wrapped inside a ThemeProvider');
  }
  return context;
};
