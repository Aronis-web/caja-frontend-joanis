/**
 * Stub vacío para @expo/metro-runtime
 * Este archivo reemplaza el runtime de Metro en web/electron para evitar
 * el error de import.meta que no está soportado fuera de módulos ES.
 *
 * El Hot Module Replacement (HMR) no funcionará en desarrollo en Electron,
 * pero esto permite que la aplicación se ejecute correctamente.
 */

// Exportar un objeto vacío para satisfacer cualquier importación
module.exports = {};

// Exportar funciones stub por si algún módulo las usa
module.exports.registerRootComponent = function (component) {
  return component;
};

module.exports.activateKeepAwake = function () {};
module.exports.deactivateKeepAwake = function () {};
