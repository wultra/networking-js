/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNResponse, WPNResponseError } from "./WPNResponse"
import { WPNException } from "./WPNException"
import { WPNLogger, WPNLoggerConfig, WPNLoggerVerbosity } from "./WPNLogger"
import { WPNUserAgent, WPNUserAgentUtils } from "./WPNUserAgent"
import { WPNEndpoint, WPNEndpointType } from "./WPNEndpoint"
import { decodeBase64, encodeBase64, decodeBase64Bytes, encodeBase64Bytes } from "./WPNBase64"
import { WPNConfig, WPNRequestInterceptor } from "./WPNConfig"

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

    protected constructor(config: WPNConfig, defaultBaseURL: () => Promise<string>) {
        // Reject the removed positional arguments, e.g. `new WPNNetworking(pa, "https://...")`, from untyped callers.
        if (typeof config !== "object" || config === null) {
            throw new WPNException("WPNNetworking: Configuration must be a WPNConfig object.")
        }
        this.baseURL = config.baseURL || defaultBaseURL
        this.acceptLanguage = config.acceptLanguage || "en"
        this.userAgent = config.userAgent || WPNUserAgent.LIBRARY_DEFAULT
        this.requestInterceptors = Object.freeze((config.requestInterceptors || []).slice())
    }

    protected async callInternal<TRequest, TResponse>(
        requestData: TRequest, 
        endpoint: WPNEndpoint<TRequest, TResponse>,
        sign: (body: string) => Promise<WPNAuthToken>,
        signWithToken: () => Promise<WPNAuthToken>
    ): Promise<WPNResponse<TResponse>> {

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

        // Encrypt the request if needed
        const encryptor = await this.getEncryptor(endpoint)
        try {
            const requestBody = await this.encryptRequest(requestSerialized, endpoint, encryptor, headers)

            // Interceptors receive the final request, including authorization and encryption.
            const request = this.requestInterceptors.reduce<RequestInit>((current, intercept) => {
                const next = intercept(current)
                // Untyped callers could return nothing or a Promise, which fetch would send as an empty GET.
                if (!next || typeof (next as PromiseLike<unknown>).then === "function") {
                    Promise.resolve(next).catch(() => {}) // the call fails below, avoid an unhandled rejection
                    throw new WPNException("WPNNetworking: Request interceptor must synchronously return a RequestInit.")
                }
                return next
            }, { method: endpoint.method, headers, body: requestBody })

            WPNLogger.info(` -> ${request.method} ${url}`)
            if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
                WPNLogger.verbose(this.getHeadersString(new Headers(request.headers)))
                if (encryptor) {
                    WPNLogger.verbose(requestSerialized)
                    WPNLogger.verbose("ENCRYPTED BODY: " + encodeBase64Bytes(request.body as Uint8Array))
                } else {
                    WPNLogger.verbose(request.body)
                }
            }

            // Fetch the result and get the response
            const result = await fetch(url, request)
            // Parse plaintext HTTP errors without consuming the single-use decryptor.
            if (encryptor && !result.ok) {
                const errorBody = await result.text()
                WPNLogger.info(` <- ${endpoint.method} ${url} - ${result.status}`)
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
                ? encodeBase64Bytes(new Uint8Array(await result.arrayBuffer()))
                : await result.text()

            // Decrypt the response if needed
            try {
                const decryptedResponse = encryptor
                    ? decodeBase64(await encryptor.decryptResponse(responseBody))
                    : responseBody

                WPNLogger.info(` <- ${endpoint.method} ${url} - ${result.status}`)
                if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
                    WPNLogger.verbose(this.getHeadersString(result.headers))
                    WPNLogger.verbose(decryptedResponse)
                    if (encryptor) {
                        WPNLogger.verbose("ENCRYPTED RESPONSE: " + responseBody)
                    }
                }

                return this.parseResponse(decryptedResponse, endpoint, result)
            } catch (e) {
                WPNLogger.error(`Failed to decrypt response from ${endpoint.method} ${url}. Falling back to plain response parsing.`)
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
