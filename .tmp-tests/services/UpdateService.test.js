"use strict";
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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};
const assertEqual = (actual, expected, message) => {
    assert(actual === expected, `${message} (esperado: ${String(expected)}, recibido: ${String(actual)})`);
};
// Aislar el filesystem: redirigir HOME a un tempdir antes de cargar el módulo,
// porque UpdateService usa process.env.HOME como fallback cuando electron.app
// no está disponible (renderer/tests Node puro).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-service-test-'));
process.env.HOME = tmpDir;
process.env.USERPROFILE = tmpDir;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require('./UpdateService');
const { UpdateService, initializeUpdateService, getUpdateService } = mod;
const run = () => {
    // 1) El módulo se carga sin lanzar pese a no haber Electron runtime
    assert(typeof UpdateService === 'function', 'UpdateService debe exportarse como clase');
    assert(typeof initializeUpdateService === 'function', 'initializeUpdateService debe existir');
    assert(typeof getUpdateService === 'function', 'getUpdateService debe existir');
    // 2) getUpdateService antes de inicializar debe lanzar con mensaje claro
    let threw = false;
    try {
        getUpdateService();
    }
    catch (err) {
        threw = true;
        assert(err instanceof Error, 'debe lanzar Error');
        assert(err.message.includes('no inicializado'), 'mensaje debe indicar que no fue inicializado');
    }
    assert(threw, 'getUpdateService sin init debe lanzar');
    // 3) Construir con HOME apuntando a tmpdir → no debe explotar; debe escribir
    //    archivos de estado y log en el tempdir, no en %APPDATA% real.
    const service = new UpdateService('1.0.0');
    assert(service instanceof UpdateService, 'instancia válida');
    // version-state.json debe existir tras el constructor (loadVersionState lo crea)
    const stateFile = path.join(tmpDir, 'version-state.json');
    assert(fs.existsSync(stateFile), `version-state.json debe crearse en ${tmpDir}`);
    // 4) log() debe persistir entradas y no lanzar
    service.log('check', { source: 'test' });
    service.log('available', { version: '1.0.1' });
    const logFile = path.join(tmpDir, 'update-service.log');
    assert(fs.existsSync(logFile), 'update-service.log debe crearse');
    const logContents = fs.readFileSync(logFile, 'utf8');
    assert(logContents.includes('"event":"check"'), 'log debe contener evento check');
    assert(logContents.includes('"event":"available"'), 'log debe contener evento available');
    // 5) getUpdateStats refleja los logs registrados
    const stats = service.getUpdateStats();
    assertEqual(stats.totalChecks, 1, 'totalChecks=1 tras un solo check');
    assertEqual(stats.updateAttempts, 0, 'sin install: updateAttempts=0');
    assertEqual(stats.crashesDetected, 0, 'sin crash logs: crashesDetected=0');
    // 6) getTelemetryData devuelve estructura esperada (tipo ReturnType correcto)
    const telemetry = service.getTelemetryData();
    assertEqual(telemetry.version, '1.0.0', 'version reportada coincide');
    assert(Array.isArray(telemetry.recentLogs), 'recentLogs debe ser array');
    assert(telemetry.recentLogs.length >= 2, 'recentLogs incluye los logs registrados');
    assert(typeof telemetry.stats.totalChecks === 'number', 'stats tipado correctamente');
    // 7) recordInstallationAttempt incrementa el contador y NO dispara rollback
    //    inmediato (porque crashDetected sigue false).
    service.recordInstallationAttempt('1.0.1');
    const statsAfter = service.getUpdateStats();
    assertEqual(statsAfter.updateAttempts, 1, 'updateAttempts incrementa');
    assertEqual(service.shouldPerformRollback(), false, 'sin crashDetected no debe pedir rollback aunque haya intentos');
    // 8) initializeUpdateService es singleton
    const a = initializeUpdateService('2.0.0');
    const b = initializeUpdateService('3.0.0');
    assert(a === b, 'initializeUpdateService debe devolver la misma instancia');
    assert(getUpdateService() === a, 'getUpdateService devuelve singleton');
    console.log('✅ UpdateService tests: OK (8 suites)');
};
try {
    run();
}
finally {
    // Limpieza best-effort del tempdir
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    catch {
        /* ignore */
    }
}
