"use strict";
/**
 * Route Constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTES = exports.MAIN_ROUTES = exports.POS_ROUTES = exports.SELECTION_ROUTES = exports.AUTH_ROUTES = void 0;
exports.AUTH_ROUTES = {
    LOGIN: 'Login',
};
exports.SELECTION_ROUTES = {
    COMPANY_SELECTION: 'CompanySelection',
    SITE_SELECTION: 'SiteSelection',
    CASH_REGISTER_SELECTION: 'CashRegisterSelection',
};
exports.POS_ROUTES = {
    POS_DASHBOARD: 'POSDashboard',
    OPEN_SESSION: 'OpenSession',
    CLOSE_SESSION: 'CloseSession',
    NEW_SALE: 'NewSale',
    SALE_DETAIL: 'SaleDetail',
    CASH_TRANSACTION: 'CashTransaction',
    CASH_COLLECTION: 'CashCollection',
};
exports.MAIN_ROUTES = {
    HOME: 'Home',
};
exports.ROUTES = {
    ...exports.AUTH_ROUTES,
    ...exports.SELECTION_ROUTES,
    ...exports.POS_ROUTES,
    ...exports.MAIN_ROUTES,
};
