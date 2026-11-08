/**
 * Thin fetch client for Krediflo API endpoints that are not part of the
 * generated OpenAPI client (auth + user-scoped loans). Session auth uses
 * cookies — native fetch persists them, and we always send credentials.
 */

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  mobile: string;
  pan: string; // masked by server (XXXXX1234F)
  address?: string | null;
}

export interface MyLoanApplicant {
  id: number;
  firstName: string;
  lastName: string;
  pan: string;
  mobile: string;
  email: string;
  applicantType: string;
  cibilScore: number | null;
  cibilStatus: string | null;
  panVerified: boolean;
  mcaVerified: boolean;
}

export interface MyLoan {
  id: number;
  loanType: 'lap' | 'home' | 'personal' | 'business';
  loanAmount: number;
  tenure: number;
  interestRate: number | null;
  purpose: string | null;
  status:
    | 'draft'
    | 'submitted'
    | 'docs_procured'
    | 'under_review'
    | 'sent_to_bank'
    | 'approved'
    | 'rejected';
  createdAt: string;
  updatedAt: string;
  applicants: MyLoanApplicant[];
}

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      `Request failed (${res.status})`;
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

export const authApi = {
  me: () => request<{ user: User }>('/api/auth/me'),
  login: (body: { mobile: string; password: string }) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  register: (body: {
    firstName: string;
    lastName: string;
    mobile: string;
    pan: string;
    address?: string;
    password: string;
  }) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () => request<unknown>('/api/auth/logout', { method: 'POST' }),
};

export const loansApi = {
  myLoans: () => request<{ loans: MyLoan[]; total: number }>('/api/loans/my'),
};
