"use strict";
/**
 * Collections Store
 * Estado global para el sistema de recaudación de efectivo
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCollectionsStore = void 0;
const zustand_1 = require("zustand");
const CollectionsService_1 = require("@/services/CollectionsService");
const pos_1 = require("@/store/pos");
const collections_1 = require("@/types/collections");
exports.useCollectionsStore = (0, zustand_1.create)((set, get) => {
    const applyRequestStatusUpdate = async (status, requestIdHint, source = 'http') => {
        const currentActiveRequest = get().activeRequest;
        // Hidratar activeRequest mínimo si no existe (ej: pantalla reabierta con request pendiente)
        const shouldHydrateActiveRequest = !currentActiveRequest &&
            [status.id, requestIdHint].includes(status.id) &&
            [
                collections_1.CollectionRequestStatus.PENDING,
                collections_1.CollectionRequestStatus.PROCESSING,
                collections_1.CollectionRequestStatus.IN_PROGRESS,
            ].includes(status.status);
        const previousRequestStatus = get().requestStatus;
        const incomingClosureContext = status.closureContext;
        const previousClosureContext = previousRequestStatus?.closureContext;
        const incomingHasSnapshot = Boolean(incomingClosureContext?.sessionSnapshot);
        const previousHasSnapshot = Boolean(previousClosureContext?.sessionSnapshot);
        const mergedClosureContext = incomingHasSnapshot
            ? {
                ...previousClosureContext,
                ...incomingClosureContext,
                sessionSnapshot: incomingClosureContext?.sessionSnapshot,
            }
            : previousHasSnapshot
                ? previousClosureContext
                : (incomingClosureContext ?? previousClosureContext);
        const mergedStatus = {
            ...previousRequestStatus,
            ...status,
            closureContext: mergedClosureContext,
        };
        if (shouldHydrateActiveRequest) {
            const currentCashCentsFromStatus = get().cashStatus?.currentCashCents ?? 0;
            const maxCollectionCentsFromStatus = get().cashStatus?.maxCollectionCents ?? 0;
            set({
                requestStatus: mergedStatus,
                activeRequest: {
                    requestId: status.id,
                    qrToken: status.token,
                    qrUrl: status.token,
                    qrData: status.token,
                    expiresAt: status.expiresAt,
                    expiresInSeconds: status.expiresInSeconds,
                    currentCashCents: currentCashCentsFromStatus,
                    maxCollectionCents: maxCollectionCentsFromStatus,
                },
            });
        }
        else {
            set({ requestStatus: mergedStatus });
        }
        // Si se completó, expiró o fue cancelada, detener suscripción
        if ([
            collections_1.CollectionRequestStatus.COMPLETED,
            collections_1.CollectionRequestStatus.EXPIRED,
            collections_1.CollectionRequestStatus.CANCELLED,
        ].includes(status.status)) {
            console.log(`📋 [Store] Solicitud ${status.status} (fuente: ${source}), deteniendo suscripción realtime`);
            if (status.status === collections_1.CollectionRequestStatus.COMPLETED) {
                console.log(`🧾 [Store] sessionSnapshot en COMPLETED (fuente: ${source}):\n${JSON.stringify(mergedStatus.closureContext?.sessionSnapshot ?? null, null, 2)}`);
            }
            get().stopRequestStatusPolling();
            // Si se completó, actualizar el estado del efectivo y la sesión POS
            if (status.status === collections_1.CollectionRequestStatus.COMPLETED) {
                console.log('🔄 [Store] Recaudación completada, actualizando efectivo y sesión...');
                try {
                    const sessionId = pos_1.usePOSStore.getState().currentSession?.id;
                    if (sessionId) {
                        await Promise.all([
                            get().fetchCashStatus(sessionId),
                            pos_1.usePOSStore.getState().refreshSession(),
                        ]);
                        const latestCashStatus = get().cashStatus;
                        const latestSession = pos_1.usePOSStore.getState().currentSession;
                        const snapshotFromRefresh = latestCashStatus?.sessionSnapshot ??
                            latestSession?.sessionSnapshot ??
                            latestSession?.closureContext?.sessionSnapshot;
                        if (snapshotFromRefresh) {
                            set((state) => ({
                                requestStatus: state.requestStatus
                                    ? {
                                        ...state.requestStatus,
                                        closureContext: {
                                            ...state.requestStatus.closureContext,
                                            sessionSnapshot: snapshotFromRefresh,
                                        },
                                    }
                                    : state.requestStatus,
                            }));
                            console.log(`🧾 [Store] sessionSnapshot desde refresh (cash-status/session):\n${JSON.stringify(snapshotFromRefresh, null, 2)}`);
                        }
                        console.log('✅ [Store] Estado de efectivo y sesión actualizados');
                    }
                    else {
                        console.warn('⚠️ [Store] No hay sesión activa para refrescar después de recaudación');
                    }
                }
                catch (refreshError) {
                    console.error('❌ [Store] Error refrescando datos tras recaudación:', refreshError);
                }
            }
        }
    };
    return {
        // Estado inicial
        cashStatus: null,
        isCashStatusLoading: false,
        cashStatusError: null,
        activeRequest: null,
        requestStatus: null,
        isRequestLoading: false,
        requestError: null,
        cashStatusPollingId: null,
        requestStatusPollingId: null,
        // ═══════════════════════════════════════════════════════════════════════════
        // ESTADO DE EFECTIVO
        // ═══════════════════════════════════════════════════════════════════════════
        fetchCashStatus: async (sessionId) => {
            try {
                set({ isCashStatusLoading: true, cashStatusError: null });
                const cashStatus = await CollectionsService_1.collectionsService.getCashStatus(sessionId);
                set({ cashStatus, isCashStatusLoading: false });
                // Si hay una solicitud pendiente en el estado, cargarla y suscribirse en realtime
                if (cashStatus.pendingRequest && !get().activeRequest) {
                    console.log('📋 [Store] Solicitud pendiente encontrada:', cashStatus.pendingRequest.id);
                    await get().checkRequestStatus(cashStatus.pendingRequest.id);
                    get().startRequestStatusPolling(cashStatus.pendingRequest.id);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error al obtener estado de efectivo';
                console.error('❌ [Store] Error en fetchCashStatus:', errorMessage);
                set({ cashStatusError: errorMessage, isCashStatusLoading: false });
            }
        },
        startCashStatusPolling: (sessionId, intervalMs = 30000) => {
            // Detener polling anterior si existe
            get().stopCashStatusPolling();
            console.log(`🔄 [Store] Iniciando polling de estado de efectivo cada ${intervalMs / 1000}s`);
            // Fetch inicial
            get().fetchCashStatus(sessionId);
            // Iniciar polling
            const pollingId = setInterval(() => {
                get().fetchCashStatus(sessionId);
            }, intervalMs);
            set({ cashStatusPollingId: pollingId });
        },
        stopCashStatusPolling: () => {
            const { cashStatusPollingId } = get();
            if (cashStatusPollingId) {
                console.log('⏹️ [Store] Deteniendo polling de estado de efectivo');
                clearInterval(cashStatusPollingId);
                set({ cashStatusPollingId: null });
            }
        },
        // ═══════════════════════════════════════════════════════════════════════════
        // SOLICITUD DE RECAUDACIÓN
        // ═══════════════════════════════════════════════════════════════════════════
        createCollectionRequest: async (sessionId, reason, notes, options) => {
            try {
                set({ isRequestLoading: true, requestError: null });
                const response = options?.mode === 'closure'
                    ? await CollectionsService_1.collectionsService.createClosureCollectionRequest(sessionId, {
                        expectedAmountCents: options.expectedAmountCents,
                        notes,
                    })
                    : await CollectionsService_1.collectionsService.createCollectionRequest(sessionId, {
                        reason,
                        notes,
                    });
                set({
                    activeRequest: response,
                    requestStatus: {
                        id: response.requestId,
                        status: collections_1.CollectionRequestStatus.PENDING,
                        token: response.qrToken,
                        expiresAt: response.expiresAt,
                        isExpired: false,
                        expiresInSeconds: response.expiresInSeconds,
                    },
                    isRequestLoading: false,
                });
                // Iniciar suscripción realtime del estado de la solicitud
                get().startRequestStatusPolling(response.requestId);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error al crear solicitud';
                console.error('❌ [Store] Error en createCollectionRequest:', errorMessage);
                set({ requestError: errorMessage, isRequestLoading: false });
                throw error;
            }
        },
        checkRequestStatus: async (requestId) => {
            try {
                const status = await CollectionsService_1.collectionsService.getRequestStatus(requestId);
                await applyRequestStatusUpdate(status, requestId, 'http');
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error al consultar estado';
                console.error('❌ [Store] Error en checkRequestStatus:', errorMessage);
                throw error;
            }
        },
        startRequestStatusPolling: (requestId, _intervalMs = 3000) => {
            // Detener suscripción anterior si existe
            get().stopRequestStatusPolling();
            console.log('🔄 [Store] Iniciando suscripción realtime de estado de solicitud');
            const unsubscribeRealtime = CollectionsService_1.collectionsService.subscribeRequestStatus(requestId, (status) => {
                applyRequestStatusUpdate(status, requestId, 'ws').catch((error) => {
                    console.error('❌ [Store] Error procesando estado realtime:', error);
                });
            }, (errorMessage) => {
                console.error('❌ [Store] Error websocket de solicitud:', errorMessage);
                set({ requestError: errorMessage });
            });
            // Consulta inicial para no perder estados si el evento WS llegó antes de suscribir
            get()
                .checkRequestStatus(requestId)
                .catch((error) => {
                console.warn('⚠️ [Store] No se pudo obtener estado inicial por API:', error);
            });
            // Fallback suave: mantener sincronía aunque se pierda algún evento websocket
            const fallbackInterval = setInterval(() => {
                get()
                    .checkRequestStatus(requestId)
                    .catch((error) => {
                    console.warn('⚠️ [Store] Fallback status check falló:', error);
                });
            }, 5000);
            const unsubscribe = () => {
                clearInterval(fallbackInterval);
                unsubscribeRealtime();
            };
            set({ requestStatusPollingId: unsubscribe });
        },
        stopRequestStatusPolling: () => {
            const { requestStatusPollingId } = get();
            if (requestStatusPollingId) {
                console.log('⏹️ [Store] Deteniendo suscripción realtime de solicitud');
                requestStatusPollingId();
                CollectionsService_1.collectionsService.disconnectSocket();
                set({ requestStatusPollingId: null });
            }
        },
        cancelRequest: async (requestId) => {
            const currentStatus = get().requestStatus?.status;
            if (currentStatus && currentStatus !== collections_1.CollectionRequestStatus.PENDING) {
                const statusError = 'Solo se puede cancelar una solicitud en estado PENDIENTE.';
                set({ requestError: statusError, isRequestLoading: false });
                throw new Error(statusError);
            }
            try {
                set({ isRequestLoading: true, requestError: null });
                await CollectionsService_1.collectionsService.cancelRequest(requestId);
                get().clearActiveRequest();
                set({ isRequestLoading: false });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Error al cancelar solicitud';
                console.error('❌ [Store] Error en cancelRequest:', errorMessage);
                set({ requestError: errorMessage, isRequestLoading: false });
                throw error;
            }
        },
        clearActiveRequest: () => {
            get().stopRequestStatusPolling();
            set({
                activeRequest: null,
                requestStatus: null,
                requestError: null,
            });
        },
        // ═══════════════════════════════════════════════════════════════════════════
        // UTILIDADES
        // ═══════════════════════════════════════════════════════════════════════════
        reset: () => {
            get().stopCashStatusPolling();
            get().stopRequestStatusPolling();
            set({
                cashStatus: null,
                isCashStatusLoading: false,
                cashStatusError: null,
                activeRequest: null,
                requestStatus: null,
                isRequestLoading: false,
                requestError: null,
                cashStatusPollingId: null,
                requestStatusPollingId: null,
            });
        },
    };
});
