"use client";

import type { User } from "@supabase/supabase-js";

export const LEGAL_TERMS_VERSION = "2026-06-25";
export const LEGAL_PRIVACY_VERSION = "2026-06-25";
const PENDING_LEGAL_CONSENT_KEY = "setlistlab:pending-legal-consent";

export type LegalConsentRecord = {
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  ageConfirmedAt: string;
  termsVersion: string;
  privacyVersion: string;
};

export function createLegalConsentRecord(now = new Date()): LegalConsentRecord {
  const iso = now.toISOString();
  return {
    termsAcceptedAt: iso,
    privacyAcceptedAt: iso,
    ageConfirmedAt: iso,
    termsVersion: LEGAL_TERMS_VERSION,
    privacyVersion: LEGAL_PRIVACY_VERSION,
  };
}

export function storePendingLegalConsent(record: LegalConsentRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_LEGAL_CONSENT_KEY, JSON.stringify(record));
}

export function getPendingLegalConsent() {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(PENDING_LEGAL_CONSENT_KEY);
  if (!value) return null;

  try {
    return normalizeLegalConsentRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

export function clearPendingLegalConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_LEGAL_CONSENT_KEY);
}

export function getLegalConsentFromUserMetadata(user: User | null | undefined) {
  const metadata = user?.user_metadata ?? {};
  const consent = metadata.legal_consent;
  if (!consent || typeof consent !== "object") return null;
  return normalizeLegalConsentRecord(consent);
}

function normalizeLegalConsentRecord(value: unknown): LegalConsentRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<LegalConsentRecord>;
  if (!record.termsAcceptedAt || !record.privacyAcceptedAt || !record.ageConfirmedAt) return null;

  return {
    termsAcceptedAt: String(record.termsAcceptedAt),
    privacyAcceptedAt: String(record.privacyAcceptedAt),
    ageConfirmedAt: String(record.ageConfirmedAt),
    termsVersion: String(record.termsVersion || LEGAL_TERMS_VERSION),
    privacyVersion: String(record.privacyVersion || LEGAL_PRIVACY_VERSION),
  };
}
