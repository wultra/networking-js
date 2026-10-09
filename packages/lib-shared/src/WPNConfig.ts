/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNUserAgent } from "./WPNUserAgent"

/**
 * Modifies the final request right before it is sent with `fetch`.
 *
 * Receives the request after default headers, PowerAuth authorization, and end-to-end encryption
 * were applied, and returns the request to send. Do not change `X-PowerAuth-*` headers or the body,
 * otherwise the server rejects the request.
 */
export type WPNRequestInterceptor = (request: RequestInit) => RequestInit

/** Configuration of `WPNNetworking`. Read once during construction. */
export interface WPNConfig {
    /**
     * Base URL for the networking service (usually https://<your-server>/enrollment-server/).
     *
     * If omitted, the URL is read from the PowerAuth configuration on every call, so it always matches
     * the current configuration. A call fails if PowerAuth is not configured or has no URL.
     * Providing the URL avoids this asynchronous lookup on each call.
     */
    readonly baseURL?: string
    /** Initial `WPNNetworking.acceptLanguage`. Default is "en". */
    readonly acceptLanguage?: string
    /** Initial `WPNNetworking.userAgent`. Default is `WPNUserAgent.LIBRARY_DEFAULT`. */
    readonly userAgent?: WPNUserAgent | string
    /** Interceptors applied in declaration order to every request right before it is sent. Default is none. */
    readonly requestInterceptors?: readonly WPNRequestInterceptor[]
}
