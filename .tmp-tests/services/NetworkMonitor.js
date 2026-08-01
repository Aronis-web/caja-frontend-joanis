"use strict";
/**
 * Network Monitor Service
 * Monitors network connectivity and triggers sync when reconnecting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.networkMonitor = void 0;
const config_1 = require("@/utils/config");
class NetworkMonitorService {
    constructor() {
        this.isOnline = true;
        this.listeners = new Set();
        this.reconnectListeners = new Set();
        this.healthCheckInterval = null;
        this.healthCheckIntervalMs = 30000; // 30 segundos
        this.lastHealthCheck = null;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3;
        // ============ PRIVADOS ============
        this.handleOnline = () => {
            console.log('🟢 [NETWORK] Evento online detectado');
            // Verificar con health check antes de confirmar
            this.checkConnectivity();
        };
        this.handleOffline = () => {
            console.log('🔴 [NETWORK] Evento offline detectado');
            this.setOnline(false);
        };
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    /**
     * Inicia el monitoreo de red
     */
    start() {
        if (typeof window === 'undefined')
            return;
        console.log('🌐 [NETWORK] Iniciando monitor de red...');
        // Eventos nativos del navegador
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        // Health check periódico
        this.startHealthCheck();
        console.log('✅ [NETWORK] Monitor de red iniciado');
    }
    /**
     * Detiene el monitoreo de red
     */
    stop() {
        if (typeof window === 'undefined')
            return;
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        this.stopHealthCheck();
        console.log('🛑 [NETWORK] Monitor de red detenido');
    }
    /**
     * Verifica la conectividad con el servidor
     */
    async checkConnectivity() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            // Intentar hacer un request al backend con los headers requeridos
            const response = await fetch(`${config_1.config.API_URL}/health`, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal,
                headers: {
                    'X-App-Id': config_1.config.APP_ID,
                    'X-App-Version': '1.0.0',
                },
            });
            clearTimeout(timeoutId);
            if (response.ok || response.status === 200) {
                this.consecutiveFailures = 0;
                this.lastHealthCheck = new Date();
                if (!this.isOnline) {
                    console.log('🟢 [NETWORK] Conexión restaurada (health check)');
                    this.setOnline(true);
                }
                return true;
            }
        }
        catch (error) {
            this.consecutiveFailures++;
            if (this.consecutiveFailures >= this.maxConsecutiveFailures && this.isOnline) {
                console.log('🔴 [NETWORK] Conexión perdida (health check falló)');
                this.setOnline(false);
            }
        }
        return false;
    }
    /**
     * Obtiene el estado actual de conexión
     */
    getStatus() {
        return this.isOnline;
    }
    /**
     * Obtiene la última vez que se verificó la conexión
     */
    getLastHealthCheck() {
        return this.lastHealthCheck;
    }
    /**
     * Suscribe a cambios de conexión
     */
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    /**
     * Suscribe a eventos de reconexión
     */
    onReconnect(callback) {
        this.reconnectListeners.add(callback);
        return () => this.reconnectListeners.delete(callback);
    }
    /**
     * Configura el intervalo de health check
     */
    setHealthCheckInterval(ms) {
        this.healthCheckIntervalMs = ms;
        if (this.healthCheckInterval) {
            this.stopHealthCheck();
            this.startHealthCheck();
        }
    }
    setOnline(online) {
        const wasOffline = !this.isOnline;
        this.isOnline = online;
        // Notificar a listeners
        this.listeners.forEach((callback) => {
            try {
                callback(online);
            }
            catch (error) {
                console.error('❌ [NETWORK] Error en listener de conexión:', error);
            }
        });
        // Si reconectamos, notificar a listeners de reconexión
        if (online && wasOffline) {
            console.log('🔄 [NETWORK] Reconexión detectada, notificando...');
            this.reconnectListeners.forEach((callback) => {
                try {
                    callback();
                }
                catch (error) {
                    console.error('❌ [NETWORK] Error en listener de reconexión:', error);
                }
            });
        }
    }
    startHealthCheck() {
        if (this.healthCheckInterval)
            return;
        this.healthCheckInterval = setInterval(() => {
            this.checkConnectivity();
        }, this.healthCheckIntervalMs);
        // Hacer un check inicial
        this.checkConnectivity();
    }
    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
}
exports.networkMonitor = new NetworkMonitorService();
