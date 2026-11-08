import type { Feather } from '@expo/vector-icons';

export type LoanType = 'home' | 'lap' | 'business' | 'personal';

export interface LoanProduct {
  type: LoanType;
  label: string;
  rate: string;
  highlight: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}

export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    type: 'home',
    label: 'Home Loan',
    rate: '8.40% p.a.',
    highlight: 'New purchase & balance transfer',
    description:
      'Finance your dream home or reduce your existing EMI with a balance transfer.',
    icon: 'home',
  },
  {
    type: 'lap',
    label: 'Loan Against Property',
    rate: '9.00% p.a.',
    highlight: 'High value, low interest',
    description:
      'Unlock the equity in your residential or commercial property for capital needs.',
    icon: 'map-pin',
  },
  {
    type: 'business',
    label: 'Business Loan',
    rate: '11.00% p.a.',
    highlight: 'MCA-verified processing',
    description:
      'Automatic director details and financial standing via MCA API for faster working capital.',
    icon: 'briefcase',
  },
  {
    type: 'personal',
    label: 'Personal Loan',
    rate: '10.50% p.a.',
    highlight: 'Instant eligibility check',
    description:
      'API-driven eligibility in seconds. CIBIL score verified automatically — no documents needed.',
    icon: 'user',
  },
];

export const PRODUCT_LABEL: Record<LoanType, string> = {
  home: 'Home Loan',
  lap: 'Loan Against Property',
  business: 'Business Loan',
  personal: 'Personal Loan',
};

export const PRODUCT_RATE: Record<LoanType, number> = {
  home: 8.4,
  lap: 9.0,
  business: 11.0,
  personal: 10.5,
};
