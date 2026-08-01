"use strict";
/**
 * UpdateService
 * Maneja actualizaciones de Electron con soporte para:
 * - Rollback automático
 * - Telemetría de actualizaciones
 * - Logging centralizado
 * - Detección de crashes post-actualización
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateService = void 0;
exports.initializeUpdateService = initializeUpdateService;
exports.getUpdateService = getUpdateService;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electronModule = (() => {
    try {
        return typeof require === 'function'
            ? require('electron')
            : null;
    }
    catch {
        return null;
    }
})();
const app = electronModule?.app;
class UpdateService {
    constructor(appVersion) {
        this.updateLogs = [];
        this.MAX_CRASH_ATTEMPTS = 2;
        this.CRASH_DETECTION_TIMEOUT = 60000; // 1 minuto
        const userDataPath = app ? app.getPath('userData') : process.env.HOME || '/tmp';
        this.logFile = path.join(userDataPath, 'update-service.log');
        this.versionStateFile = path.join(userDataPath, 'version-state.json');
        this.versionState = this.loadVersionState(appVersion);
        this.loadUpdateLogs();
        this.detectCrashesOnStartup();
    }
    /**
     * Cargar estado de versión desde archivo
     */
    loadVersionState(currentVersion) {
        try {
            if (fs.existsSync(this.versionStateFile)) {
                const state = JSON.parse(fs.readFileSync(this.versionStateFile, 'utf-8'));
                return {
                    ...state,
                    current: currentVersion,
                    // Reset crash detection si pasó más de CRASH_DETECTION_TIMEOUT
                    crashDetected: false,
                };
            }
        }
        catch (error) {
            console.error('[UPDATE] Error loading version state:', error);
        }
        return {
            current: currentVersion,
            previous: currentVersion,
            updateAttempts: 0,
            crashDetected: false,
        };
    }
    /**
     * Guardar estado de versión
     */
    saveVersionState() {
        try {
            fs.writeFileSync(this.versionStateFile, JSON.stringify(this.versionState, null, 2));
        }
        catch (error) {
            console.error('[UPDATE] Error saving version state:', error);
        }
    }
    /**
     * Cargar logs anteriores
     */
    loadUpdateLogs() {
        try {
            if (fs.existsSync(this.logFile)) {
                const content = fs.readFileSync(this.logFile, 'utf-8');
                const lines = content.split('\n').filter((line) => line.trim());
                this.updateLogs = lines
                    .slice(-1000) // Últimos 1000 logs
                    .map((line) => {
                    try {
                        return JSON.parse(line);
                    }
                    catch {
                        return null;
                    }
                })
                    .filter((log) => log !== null);
            }
        }
        catch (error) {
            console.error('[UPDATE] Error loading update logs:', error);
        }
    }
    /**
     * Detectar crashes después de actualización
     */
    detectCrashesOnStartup() {
        // Si la versión actual es diferente de la anterior, la actualización fue exitosa
        if (this.versionState.current !== this.versionState.previous) {
            this.log('crash_detected', {
                severity: 'info',
                message: 'Nueva versión iniciada correctamente después de actualización',
                from: this.versionState.previous,
                to: this.versionState.current,
            });
            // Reset en caso de actualización exitosa
            this.versionState.updateAttempts = 0;
            this.versionState.lastUpdateTime = new Date().toISOString();
            this.versionState.previous = this.versionState.current;
            this.saveVersionState();
            return;
        }
        // Si la versión es la misma pero se detectó una instalación previa, es un crash
        if (this.versionState.updateAttempts > 0) {
            this.versionState.updateAttempts++;
            if (this.versionState.updateAttempts >= this.MAX_CRASH_ATTEMPTS) {
                this.log('crash_detected', {
                    severity: 'critical',
                    message: 'Crash repetido detectado. Necesario rollback automático.',
                    attempts: this.versionState.updateAttempts,
                    version: this.versionState.current,
                });
                // Marcar para rollback
                this.versionState.crashDetected = true;
                this.saveVersionState();
                return;
            }
            this.log('crash_detected', {
                severity: 'warning',
                message: 'Crash detectado tras actualización. Intento ' + this.versionState.updateAttempts,
                attempts: this.versionState.updateAttempts,
            });
        }
        this.saveVersionState();
    }
    /**
     * Registrar evento de actualización
     */
    log(event, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            details,
        };
        this.updateLogs.push(logEntry);
        // Mantener últimos 1000 logs
        if (this.updateLogs.length > 1000) {
            this.updateLogs.shift();
        }
        // Escribir a archivo en tiempo real
        try {
            fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        }
        catch (error) {
            console.error('[UPDATE] Error writing to log file:', error);
        }
        // Log en consola
        const prefix = this.getLogPrefix(event);
        console.log(`[UPDATE] ${prefix}`, details || '');
    }
    /**
     * Obtener prefijo para logs
     */
    getLogPrefix(event) {
        const prefixes = {
            check: '🔍',
            available: '📦',
            download_start: '⬇️',
            download_progress: '📊',
            download_complete: '✅',
            install: '⚙️',
            rollback: '↩️',
            error: '❌',
            crash_detected: '💥',
        };
        return prefixes[event];
    }
    /**
     * Registrar intento de instalación
     */
    recordInstallationAttempt(version) {
        this.versionState.updateAttempts++;
        this.versionState.current = version;
        this.saveVersionState();
        this.log('install', {
            version,
            attempt: this.versionState.updateAttempts,
        });
    }
    /**
     * Verificar si debe hacer rollback
     */
    shouldPerformRollback() {
        return (!!this.versionState.crashDetected &&
            this.versionState.updateAttempts >= this.MAX_CRASH_ATTEMPTS);
    }
    /**
     * Obtener versión anterior para rollback
     */
    getPreviousVersion() {
        return this.versionState.previous;
    }
    /**
     * Obtener estadísticas de actualización
     */
    getUpdateStats() {
        const checks = this.updateLogs.filter((log) => log.event === 'check').length;
        const updates = this.updateLogs.filter((log) => log.event === 'install').length;
        const crashes = this.updateLogs.filter((log) => log.event === 'crash_detected').length;
        return {
            totalChecks: checks,
            totalUpdates: updates,
            lastUpdate: this.versionState.lastUpdateTime,
            updateAttempts: this.versionState.updateAttempts,
            crashesDetected: crashes,
        };
    }
    /**
     * Obtener logs formateados para envío a servidor (telemetría)
     */
    getTelemetryData() {
        return {
            stats: this.getUpdateStats(),
            recentLogs: this.updateLogs.slice(-50),
            version: this.versionState.current,
        };
    }
    /**
     * Limpiar logs antiguos (> 30 días)
     */
    cleanupOldLogs(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        this.updateLogs = this.updateLogs.filter((log) => {
            return new Date(log.timestamp) > cutoffDate;
        });
        // Reescribir archivo de logs
        try {
            const logContent = this.updateLogs.map((log) => JSON.stringify(log)).join('\n');
            fs.writeFileSync(this.logFile, logContent);
        }
        catch (error) {
            console.error('[UPDATE] Error cleaning up logs:', error);
        }
    }
}
exports.UpdateService = UpdateService;
// Instancia global
let updateServiceInstance = null;
function initializeUpdateService(appVersion) {
    if (!updateServiceInstance) {
        updateServiceInstance = new UpdateService(appVersion);
    }
    return updateServiceInstance;
}
function getUpdateService() {
    if (!updateServiceInstance) {
        throw new Error('UpdateService no inicializado. Llamar initializeUpdateService primero.');
    }
    return updateServiceInstance;
}
