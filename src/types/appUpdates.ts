/**
 * Tipos para el modulo de actualizacion de la app via /api/pos/app-updates/*
 * Espejo de solo lectura expuesto por svc-pos.
 */

export type AppUpdatePlatform = 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'web';

export interface AppRelease {
  appId: string;
  platform: AppUpdatePlatform;
  version: string;
  versionCode?: number;
  downloadUrl: string;
  checksum?: string;
  sizeBytes?: number;
  releaseNotes?: string;
  mandatory?: boolean;
  isActive?: boolean;
  releasedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckUpdateResponse {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  appId?: string;
  platform?: AppUpdatePlatform;
  downloadUrl?: string;
  checksum?: string;
  sizeBytes?: number;
  releaseNotes?: string;
  mandatory?: boolean;
  releasedAt?: string;
}
