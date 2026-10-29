/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNResponse, WPNResponseError } from "./WPNResponse"
import { WPNCancelledException, WPNException, WPNTimeoutException } from "./WPNException"
import { WPNLogger, WPNLoggerConfig, WPNLoggerVerbosity } from "./WPNLogger"
import { WPNUserAgent, WPNUserAgentUtils } from "./WPNUserAgent"
import { WPNEndpoint, WPNEndpointType } from "./WPNEndpoint"
import { decodeBase64, encodeBase64, decodeBase64Bytes, encodeBase64Bytes } from "./WPNBase64"
import { WPNCallOptions, WPNConfig, WPNRequest, WPNRequestInterceptor } from "./WPNConfig"

/** Authentication token to be added to the request headers */
export type WPNAuthToken = { key: string, value: string } | undefined

/** Base class for networking implementations. */
export abstract class WPNNetworkingBase {

    /**
     * Accept language for the outgoing requests headers.
     *
     * Default value is "en".
     *
     * Standard RFC "Accept-Language" https://tools.ietf.org/html/rfc7231#section-5.3.5
     * Response texts are based on this setting. For example when "de" is set, server
     * will return operation texts in german (if available).
     */
    acceptLanguage: string

    /**
     * User-Agent string for the outgoing requests headers.
     * 
     * Default value is `WPNUserAgent.LIBRARY_DEFAULT`.
     * 
     * Standard RFC "User-Agent" https://tools.ietf.org/html/rfc7231#section-5.5.3
     */
    userAgent: WPNUserAgent | string

    private readonly baseURL: string | (() => Promise<string>)
    private readonly requestInterceptors: readonly WPNRequestInterceptor[]
    private readonly timeout: number

    protected constructor(config: WPNConfig, defaultBaseURL: () => Promise<string>) {
        // Reject the removed positional arguments, e.g. `new WPNNetworking(pa, "https://...")`, from untyped callers.
        if (typeof config !== "object" || config === null) {
            throw new WPNException("WPNNetworking: Configuration must be a WPNConfig object.")
        }
        this.baseURL = config.baseURL || defaultBaseURL
        this.acceptLanguage = config.acceptLanguage || "en"
        this.userAgent = config.userAgent || WPNUserAgent.LIBRARY_DEFAULT
        this.requestInterceptors = Object.freeze((config.requestInterceptors || []).slice())
        this.timeout = validateTimeout(config.timeout, "WPNConfig.timeout") ?? 0
    }

    protected async callInternal<TRequest, TResponse>(
        requestData: TRequest, 
        endpoint: WPNEndpoint<TRequest, TResponse>,
        sign: (body: string) => Promise<WPNAuthToken>,
        signWithToken: () => Promise<WPNAuthToken>,
        options: WPNCallOptions | undefined
    ): Promise<WPNResponse<TResponse>> {

        const timeout = validateTimeout(options?.timeout, "WPNCallOptions.timeout") ?? this.timeout
        const signal = options?.signal
        try {
            const response = await this.perform(requestData, endpoint, sign, signWithToken, timeout, signal)
            // PowerAuth steps cannot be interrupted, so honor a cancellation that happened during decryption.
            throwIfCancelled(signal)
            return response
        } catch (e) {
            // Once cancelled, report the cancellation instead of failures it caused, e.g. a rejected biometric prompt.
            if (signal?.aborted && !(e instanceof WPNCancelledException) && !(e instanceof WPNTimeoutException)) {
                throw new WPNCancelledException(signal.reason)
            }
            throw e
        }
    }

    private async perform<TRequest, TResponse>(
        requestData: TRequest,
        endpoint: WPNEndpoint<TRequest, TResponse>,
        sign: (body: string) => Promise<WPNAuthToken>,
        signWithToken: () => Promise<WPNAuthToken>,
        timeout: number,
        signal: AbortSignal | undefined
    ): Promise<WPNResponse<TResponse>> {

        throwIfCancelled(signal)

        // prepare URL, body and headers
        const baseURL = typeof this.baseURL === "string" ? this.baseURL : await this.baseURL()
        const url = (baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL) + endpoint.path
        const requestSerialized = JSON.stringify(requestData)
        const headers = new Headers()

        const jsonType = "application/json" // Only JSON requests are supported
        headers.set("Content-Type", jsonType)
        headers.set("Accept", jsonType)
        headers.set("Accept-Language", this.acceptLanguage)

        // Set User-Agent header
        const userAgent = await WPNUserAgentUtils.get(this.userAgent)
        if (userAgent) {
            headers.set("User-Agent", userAgent)
        }

        // Do not start signing, which can show a biometric prompt, for a cancelled call.
        throwIfCancelled(signal)

        // Authenticate the plaintext request body before encryption.
        let authHeader: WPNAuthToken
        if (endpoint.type === WPNEndpointType.SIGNED) {
            // Signed request
            authHeader = await sign(requestSerialized)
        } else if (endpoint.type === WPNEndpointType.SIGNED_WITH_TOKEN) {
            // Signed request with token
            authHeader = await signWithToken()
        }
        if (authHeader) {
            headers.set(authHeader.key, authHeader.value)
        }
        // Signing cannot be interrupted, so do not continue with a request cancelled meanwhile.
        throwIfCancelled(signal)

        // Encrypt the request if needed
        const encryptor = await this.getEncryptor(endpoint)
        try {
            const requestBody = await this.encryptRequest(requestSerialized, endpoint, encryptor, headers)

            // Interceptors receive the final request, including authorization and encryption.
            const request = this.requestInterceptors.reduce<WPNRequest>((current, intercept) => {
                const next = intercept(current)
                // Untyped callers could return nothing, a Promise, or a request without a URL.
                if (!next || typeof next.url !== "string" || typeof (next as { then?: unknown }).then === "function") {
                    Promise.resolve(next).catch(() => {}) // the call fails below, avoid an unhandled rejection
                    throw new WPNException("WPNNetworking: Request interceptor must synchronously return a request with a URL.")
                }
                return next
            }, { url, method: endpoint.method, headers, body: requestBody })

            WPNLogger.info(` -> ${request.method} ${request.url}`)
            if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
                WPNLogger.verbose(this.getHeadersString(new Headers(request.headers)))
                if (encryptor) {
                    WPNLogger.verbose(requestSerialized)
                    WPNLogger.verbose("ENCRYPTED BODY: " + encodeBase64Bytes(request.body as Uint8Array))
                } else {
                    WPNLogger.verbose(request.body)
                }
            }

            // Fetch the result and read the response body; encrypted successful responses are binary.
            const { response: result, body } = await this.fetchResponse(request, response => !!encryptor && response.ok, timeout, signal)
            // Parse plaintext HTTP errors without consuming the single-use decryptor.
            if (encryptor && !result.ok) {
                const errorBody = body as string
                WPNLogger.info(` <- ${request.method} ${request.url} - ${result.status}`)
                if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
                    WPNLogger.verbose(this.getHeadersString(result.headers))
                    WPNLogger.verbose(errorBody)
                }
                let errorResponse: WPNResponse<TResponse>
                try {
                    errorResponse = this.parseResponse<TResponse>(errorBody, endpoint, result)
                } catch (e) {
                    if (e instanceof WPNException) {
                        throw e
                    }
                    throw new WPNException("Failed to parse the response of an unsuccessful encrypted request", { status: result.status })
                }
                if (errorResponse.status !== "ERROR") {
                    throw new WPNException("Expected an error response for unsuccessful encrypted request", { status: result.status })
                }
                return errorResponse
            }

            const responseBody = encryptor
                ? encodeBase64Bytes(body as Uint8Array)
                : body as string

            // Decrypt the response if needed
            try {
                const decryptedResponse = encryptor
                    ? decodeBase64(await encryptor.decryptResponse(responseBody))
                    : responseBody

                WPNLogger.info(` <- ${request.method} ${request.url} - ${result.status}`)
                if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
                    WPNLogger.verbose(this.getHeadersString(result.headers))
                    WPNLogger.verbose(decryptedResponse)
                    if (encryptor) {
                        WPNLogger.verbose("ENCRYPTED RESPONSE: " + responseBody)
                    }
                }

                return this.parseResponse(decryptedResponse, endpoint, result)
            } catch (e) {
                WPNLogger.error(`Failed to decrypt response from ${request.method} ${request.url}. Falling back to plain response parsing.`)
                try {
                    // error responses might not be encrypted, so try to parse the response as plain, but only for error responses
                    const plainResponse = this.parseResponse<TResponse>(encryptor ? decodeBase64(responseBody) : responseBody, endpoint, result)
                    if (plainResponse.status == "ERROR") {
                        return plainResponse
                    }
                } catch {
                    // ignore parsing errors
                }
                throw e // rethrow original exception
            }
        } finally {
            await encryptor?.release()
        }
    }

    /**
     * Sends the request and reads the response body, as bytes when `binary` returns true.
     *
     * Rejects with `WPNTimeoutException` or `WPNCancelledException` and aborts the request when the timeout
     * elapses or the signal is aborted. The call rejects even if the platform `fetch` ignores the abort.
     */
    private async fetchResponse(
        request: WPNRequest,
        binary: (response: Response) => boolean,
        timeout: number,
        cancelSignal: AbortSignal | undefined
    ): Promise<{ response: Response, body: string | Uint8Array }> {
        const send = async (signal?: AbortSignal) => {
            // The library owns the signal, so timeout and cancellation work regardless of interceptors.
            const response = await fetch(request.url, signal
                ? Object.create(request, { signal: { value: signal, enumerable: true } })
                : request)
            const body = binary(response) ? new Uint8Array(await response.arrayBuffer()) : await response.text()
            return { response, body }
        }
        if (!timeout && !cancelSignal) {
            return send()
        }
        throwIfCancelled(cancelSignal)

        const controller = new AbortController()
        let timer: ReturnType<typeof setTimeout> | undefined
        let onCancel: (() => void) | undefined
        const aborted = new Promise<never>((_, reject) => {
            const abort = (error: WPNException, message: string) => {
                WPNLogger.info(` <- ${request.method} ${request.url} - ${message}`)
                reject(error)
                controller.abort()
            }
            onCancel = () => abort(new WPNCancelledException(cancelSignal?.reason), "cancelled")
            cancelSignal?.addEventListener("abort", onCancel)
            if (timeout) {
                timer = setTimeout(() => abort(new WPNTimeoutException(timeout), `timed out after ${timeout} ms`), timeout)
            }
        })
        try {
            const sending = send(controller.signal)
            sending.catch(() => {}) // the abort error is reported instead of the fetch error
            return await Promise.race([sending, aborted])
        } finally {
            clearTimeout(timer)
            cancelSignal?.removeEventListener("abort", onCancel!)
        }
    }

    private parseResponse<TResponse>(body: string, endpoint: WPNEndpoint<any, TResponse>, result: Response): WPNResponse<TResponse> {
        // parse the response
        const response = JSON.parse(body, (key: string, value: any) => {

            // TODO: resolve nested date fields
            if (endpoint.responseConfig?.dateFields?.some(field => field === key)) {
                return new Date(value)
            }
            return value
        }) as WPNResponse<TResponse>

        if (response.status == "ERROR") {
            if (response.responseObject === undefined) {
                throw new WPNException("Error retrieved but no error data", { ...result })
            }
            response.responseError = response.responseObject as WPNResponseError
            response.responseObject = undefined
        } else if (response.status != "OK") {
            throw new WPNException(`Unknown response status: ${response.status}`, { ...result })
        }

        return response
    }

    /** Encrypt the request body if needed and add its encryption headers. */
    private async encryptRequest<TRequest, TResponse>(
        body: string | undefined,
        endpoint: WPNEndpoint<TRequest, TResponse>,
        encryptor: WPNEncryptor | undefined,
        headers: Headers
    ): Promise<RequestInit["body"]> {
        if (!encryptor) {
            return body
        }
        const encrypted = await encryptor.encryptRequest(body === undefined ? undefined : encodeBase64(body))
        // Signed requests carry the encryption context in their authentication header (native SDK parity).
        if (endpoint.type !== WPNEndpointType.SIGNED) {
            encrypted.requestHeaders.forEach(header => headers.set(header.name, header.value))
        }
        return decodeBase64Bytes(encrypted.requestBody)
    }

    /** 
     * Get encryptor for the specified endpoint, if end-to-end encryption is enabled. 
     * 
     * Actual implementation expects to retrieve encryptor from PowerAuth instance.
     */
    protected abstract getEncryptor<TRequest, TResponse>(endpoint: WPNEndpoint<TRequest, TResponse>): Promise<WPNEncryptor | undefined>

    // Helper to convert headers to string for logging
    private getHeadersString(headers: Headers): string {
        let result = "Headers: {"
        headers.forEach( (v: string, k: string) => {
            result += ` "${k}:" "${v}",`
        })
        return result + "}"
    }
}

// Largest delay supported by `setTimeout`.
const MAX_TIMEOUT = 2147483647

function validateTimeout(timeout: unknown, name: string): number | undefined {
    if (timeout === undefined) {
        return undefined
    }
    if (typeof timeout !== "number" || !(timeout >= 0 && timeout <= MAX_TIMEOUT)) {
        throw new WPNException(`WPNNetworking: ${name} must be a number of milliseconds from 0 to ${MAX_TIMEOUT}.`)
    }
    return timeout
}

function throwIfCancelled(signal: AbortSignal | undefined) {
    if (signal?.aborted) {
        throw new WPNCancelledException(signal.reason)
    }
}

// Single-use encryptor for one request and response exchange.
export interface WPNEncryptor {
    encryptRequest(bodyBase64?: string): Promise<WPNEncryptedRequestData>
    decryptResponse(responseBodyBase64: string): Promise<string>
    release(): Promise<void>
}

export interface WPNEncryptedRequestData {
    readonly requestBody: string
    readonly requestHeaders: ReadonlyArray<{ name: string, value: string }>
}
