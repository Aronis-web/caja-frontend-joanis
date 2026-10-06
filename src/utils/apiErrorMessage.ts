/**
 * Arma el mensaje de error que ve el cajero a partir de la respuesta del backend.
 *
 * Un 400 de negocio (p. ej. "Stock insuficiente") trae en `errors` el detalle por
 * producto: sin agregarlo el cajero no sabia que producto faltaba y reintentaba
 * la misma venta a ciegas.
 */
export const buildApiErrorMessage = (errorData: unknown, status: number): string => {
  const data = (errorData && typeof errorData === 'object' ? errorData : {}) as {
    message?: unknown;
    errors?: unknown;
  };

  const base = Array.isArray(data.message)
    ? data.message.filter((m) => typeof m === 'string').join('\n')
    : typeof data.message === 'string'
      ? data.message
      : '';

  const details = Array.isArray(data.errors)
    ? data.errors.filter((e): e is string => typeof e === 'string' && e.trim() !== '')
    : [];

  return [base || `HTTP error! status: ${status}`, ...details].join('\n');
};
