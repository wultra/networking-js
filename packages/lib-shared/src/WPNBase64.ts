/**
 * Copyright Wultra s.r.o.
 * Licensed under the Apache License, Version 2.0 (see LICENSE).
 */

// The native bridge accepts Base64 for both UTF-8 plaintext and encrypted bytes.
// Use Web APIs available in React Native and Cordova, without requiring Node's Buffer.
export function encodeBase64(text: string): string {
    return btoa(encodeURIComponent(text).replace(/%([0-9A-F]{2})/g,
        (_match, hex: string) => String.fromCharCode(parseInt(hex, 16))))
}

export function decodeBase64(base64: string): string {
    const bytes = atob(base64)
    let encoded = ""
    for (let i = 0; i < bytes.length; i++) {
        encoded += "%" + ("0" + bytes.charCodeAt(i).toString(16)).slice(-2)
    }
    return decodeURIComponent(encoded)
}

/** Preserve arbitrary encrypted bytes across the HTTP/native bridge boundary. */
export function decodeBase64Bytes(base64: string) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

export function encodeBase64Bytes(bytes: Uint8Array): string {
    let binary = ""
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}
