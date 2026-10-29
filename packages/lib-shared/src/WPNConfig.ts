/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNUserAgent } from "./WPNUserAgent"

/** Request passed to `fetch`: its options extended with the full request URL. */
export interface WPNRequest extends RequestInit {
    url: string
}

/**
 * Modifies the final request right before it is sent with `fetch`.
 *
 * Receives the request after default headers, PowerAuth authorization, and end-to-end encryption
 * were applied, and returns the request to send. Do not change `X-PowerAuth-*` headers or the body,
 * otherwise the server rejects the request. The PowerAuth headers are sent to the returned URL.
 */
export type WPNRequestInterceptor = (request: WPNRequest) => WPNRequest

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
    /**
     * Timeout of every request in milliseconds. Default is `0`, which means no timeout.
     *
     * The timeout covers sending the request and receiving the response. It does not include
     * the PowerAuth signing and encryption before the request is sent, such as a biometric prompt.
     * When it elapses, the call rejects with `WPNTimeoutException`. Override it per call with `WPNCallOptions.timeout`.
     */
    readonly timeout?: number
}

/** Options of a single `WPNNetworking.call()`. */
export interface WPNCallOptions {
    /**
     * Signal that cancels the call. When it is aborted, the call rejects with `WPNCancelledException`.
     *
     * A request in flight is aborted. If PowerAuth is signing or encrypting the request, the call rejects
     * once that step finishes and the request is not sent.
     */
    readonly signal?: AbortSignal
    /** Timeout of this call in milliseconds. Overrides `WPNConfig.timeout`. Use `0` to disable the timeout. */
    readonly timeout?: number
}
