"use strict";
/**
 * AppUpdatesService
 * Cliente HTTP para los endpoints publicos /api/pos/app-updates/*
 * expuestos por svc-pos (espejo de solo lectura de svc-admin).
 *
 * No requiere Authorization: los endpoints son publicos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.appUpdatesService = void 0;
const config_1 = require("@/utils/config");
const BASE_PATH = '/api/pos/app-updates';
class AppUpdatesService {
    constructor() {
        this.baseURL = config_1.config.API_URL;
    }
    async request(endpoint, init = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            Accept: 'application/json',
            'x-app-id': config_1.config.APP_ID,
            ...init.headers,
        };
        const response = await fetch(url, { ...init, headers });
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const body = await response.json();
                if (body?.message)
                    message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
            }
            catch {
                // ignore JSON parse errors
            }
            const err = new Error(message);
            err.status = response.status;
            throw err;
        }
        return (await response.json());
    }
    /**
     * P1. Verifica si hay una actualizacion para una app/plataforma dadas.
     */
    async check(params) {
        const query = new URLSearchParams({
            appId: params.appId,
            platform: params.platform,
            currentVersion: params.currentVersion,
        }).toString();
        return this.request(`${BASE_PATH}/check?${query}`);
    }
    /**
     * P2. Devuelve la ultima version activa de todas las apps.
     */
    async latestAll() {
        return this.request(`${BASE_PATH}/latest`);
    }
    /**
     * P3. Ultima version activa de una app y plataforma.
     */
    async latest(appId, platform) {
        return this.request(`${BASE_PATH}/latest/${encodeURIComponent(appId)}/${encodeURIComponent(platform)}`);
    }
    /**
     * P4. Listado de releases para una app (opcionalmente filtrado por plataforma).
     */
    async releases(appId, platform) {
        const qs = platform ? `?platform=${encodeURIComponent(platform)}` : '';
        return this.request(`${BASE_PATH}/releases/${encodeURIComponent(appId)}${qs}`);
    }
    /**
     * P5. Construye la URL absoluta para forzar la descarga desde svc-pos.
     * Usar como fallback cuando downloadUrl del check apunta a svc-admin y
     * queremos garantizar disponibilidad aunque svc-admin este caido.
     */
    buildDownloadUrl(appId, platform, version) {
        return `${this.baseURL}${BASE_PATH}/download/${encodeURIComponent(appId)}/${encodeURIComponent(platform)}/${encodeURIComponent(version)}`;
    }
}
exports.appUpdatesService = new AppUpdatesService();
exports.default = exports.appUpdatesService;
