"use strict";
// Authentication types based on the API guide
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthError = void 0;
class AuthError extends Error {
    constructor(code, message, status) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.status = status;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AuthError);
        }
    }
}
exports.AuthError = AuthError;
