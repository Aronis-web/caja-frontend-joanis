/**
 * Network Monitor Service
 * Monitors network connectivity and triggers sync when reconnecting
 */

import { config } from '@/utils/config';

type ConnectionCallback = (isOnline: boolean) => void;
type ReconnectCallback = () => void;

class NetworkMonitorService {
  private isOnline: boolean = true;
  private listeners: Set<ConnectionCallback> = new Set();
  private reconnectListeners: Set<ReconnectCallback> = new Set();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervalMs: number = 30000; // 30 segundos
  private lastHealthCheck: Date | null = null;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 3;

  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Inicia el monitoreo de red
   */
  start(): void {
    if (typeof window === 'undefined') return;

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
  stop(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    this.stopHealthCheck();

    console.log('🛑 [NETWORK] Monitor de red detenido');
  }

  /**
   * Verifica la conectividad con el servidor
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Intentar hacer un request al backend con los headers requeridos
      const response = await fetch(`${config.API_URL}/health`, {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'X-App-Id': config.APP_ID,
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
    } catch (error) {
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
  getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Obtiene la última vez que se verificó la conexión
   */
  getLastHealthCheck(): Date | null {
    return this.lastHealthCheck;
  }

  /**
   * Suscribe a cambios de conexión
   */
  subscribe(callback: ConnectionCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Suscribe a eventos de reconexión
   */
  onReconnect(callback: ReconnectCallback): () => void {
    this.reconnectListeners.add(callback);
    return () => this.reconnectListeners.delete(callback);
  }

  /**
   * Configura el intervalo de health check
   */
  setHealthCheckInterval(ms: number): void {
    this.healthCheckIntervalMs = ms;
    if (this.healthCheckInterval) {
      this.stopHealthCheck();
      this.startHealthCheck();
    }
  }

  // ============ PRIVADOS ============

  private handleOnline = (): void => {
    console.log('🟢 [NETWORK] Evento online detectado');
    // Verificar con health check antes de confirmar
    this.checkConnectivity();
  };

  private handleOffline = (): void => {
    console.log('🔴 [NETWORK] Evento offline detectado');
    this.setOnline(false);
  };

  private setOnline(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    // Notificar a listeners
    this.listeners.forEach((callback) => {
      try {
        callback(online);
      } catch (error) {
        console.error('❌ [NETWORK] Error en listener de conexión:', error);
      }
    });

    // Si reconectamos, notificar a listeners de reconexión
    if (online && wasOffline) {
      console.log('🔄 [NETWORK] Reconexión detectada, notificando...');
      this.reconnectListeners.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('❌ [NETWORK] Error en listener de reconexión:', error);
        }
      });
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.checkConnectivity();
    }, this.healthCheckIntervalMs);

    // Hacer un check inicial
    this.checkConnectivity();
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const networkMonitor = new NetworkMonitorService();
