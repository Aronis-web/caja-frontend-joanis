/**
 * AppUpdatesService
 * Cliente HTTP para los endpoints publicos /api/app-updates/*
 * expuestos por svc-admin.
 *
 * No requiere Authorization: los endpoints son publicos.
 */

import { config } from '@/utils/config';
import type {
  AppRelease,
  AppUpdatePlatform,
  CheckUpdateResponse,
} from '@/types/appUpdates';

const BASE_PATH = '/api/app-updates';

class AppUpdatesService {
  private baseURL: string;

  constructor() {
    this.baseURL = config.API_URL;
  }

  private async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-app-id': config.APP_ID,
      ...(init.headers as Record<string, string>),
    };

    const response = await fetch(url, { ...init, headers });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      } catch {
        // ignore JSON parse errors
      }
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return (await response.json()) as T;
  }

  /**
   * P1. Verifica si hay una actualizacion para una app/plataforma dadas.
   */
  async check(params: {
    appId: string;
    platform: AppUpdatePlatform;
    currentVersion: string;
  }): Promise<CheckUpdateResponse> {
    const query = new URLSearchParams({
      appId: params.appId,
      platform: params.platform,
      currentVersion: params.currentVersion,
    }).toString();
    return this.request<CheckUpdateResponse>(`${BASE_PATH}/check?${query}`);
  }

  /**
   * P2. Devuelve la ultima version activa de todas las apps.
   */
  async latestAll(): Promise<AppRelease[]> {
    return this.request<AppRelease[]>(`${BASE_PATH}/latest`);
  }

  /**
   * P3. Ultima version activa de una app y plataforma.
   */
  async latest(appId: string, platform: AppUpdatePlatform): Promise<AppRelease> {
    return this.request<AppRelease>(
      `${BASE_PATH}/latest/${encodeURIComponent(appId)}/${encodeURIComponent(platform)}`
    );
  }

  /**
   * P4. Listado de releases para una app (opcionalmente filtrado por plataforma).
   */
  async releases(appId: string, platform?: AppUpdatePlatform): Promise<AppRelease[]> {
    const qs = platform ? `?platform=${encodeURIComponent(platform)}` : '';
    return this.request<AppRelease[]>(
      `${BASE_PATH}/releases/${encodeURIComponent(appId)}${qs}`
    );
  }

  /**
   * P5. Construye la URL absoluta de descarga contra el endpoint de app-updates.
   * Usar como fallback cuando downloadUrl del check no viene o queremos
   * garantizar que la descarga pase por el mismo host del API.
   */
  buildDownloadUrl(
    appId: string,
    platform: AppUpdatePlatform,
    version: string
  ): string {
    return `${this.baseURL}${BASE_PATH}/download/${encodeURIComponent(appId)}/${encodeURIComponent(platform)}/${encodeURIComponent(version)}`;
  }
}

export const appUpdatesService = new AppUpdatesService();
export default appUpdatesService;
