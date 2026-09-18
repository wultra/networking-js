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
import { WPNEndpoint, WPNEndpointType, WPNE2EEConfiguration } from "./WPNEndpoint"
import { decodeBase64, encodeBase64, decodeBase64Bytes, encodeBase64Bytes } from "./WPNBase64"

/** Function to process requests before sending */
export type WPNRequestProcessor = (request: RequestInit) => RequestInit
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
    acceptLanguage = "en"

    /**
     * User-Agent string for the outgoing requests headers.
     * 
     * Default value is `WPNUserAgent.LIBRARY_DEFAULT`.
     * 
     * Standard RFC "User-Agent" https://tools.ietf.org/html/rfc7231#section-5.5.3
     */
    userAgent: WPNUserAgent | string = WPNUserAgent.LIBRARY_DEFAULT

    private baseURL: string | (() => Promise<string>)

    protected constructor(baseURL: string | (() => Promise<string>), acceptLanguage?: string, userAgent?: WPNUserAgent | string) {
        this.baseURL = baseURL
        if (acceptLanguage) {
            this.acceptLanguage = acceptLanguage
        }
        if (userAgent) {
            this.userAgent = userAgent
        }
    }

    protected async callInternal<TRequest, TResponse>(
        requestData: TRequest, 
        endpoint: WPNEndpoint<TRequest, TResponse>,
        sign: (body: string) => Promise<WPNAuthToken>,
        signWithToken: () => Promise<WPNAuthToken>,
        requestProcessor?: WPNRequestProcessor
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

            // Create the request object
            let request: RequestInit = {
                method: endpoint.method,
                headers: headers,
                body: requestBody
            }

            // Allow request processor to modify the request
            if (requestProcessor) {
                request = requestProcessor(request)
            }

            WPNLogger.info(` -> ${endpoint.method} ${url}`)
            if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
                WPNLogger.verbose(this.getHeadersString(request.headers as Headers))
                WPNLogger.verbose(requestSerialized)
                if (requestBody !== requestSerialized) {
                    WPNLogger.verbose("ENCRYPTED BODY: " + requestBody)
                }
            }

            // Fetch the result and get the response
            const result = await fetch(url, request)
            // Parse plaintext HTTP errors without consuming the single-use decryptor.
            if (encryptor && !result.ok) {
                const errorResponse = this.parseResponse<TResponse>(await result.text(), endpoint, result)
                if (errorResponse.status !== "ERROR") {
                    throw new WPNException("Expected an error response for unsuccessful encrypted request", { ...result })
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
            if (endpoint.responseConfig?.dateFields?.includes(key)) {
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
        // Activation-scoped signed requests carry encryption context in their authentication header.
        if (endpoint.type !== WPNEndpointType.SIGNED || endpoint.e2eeConfig !== WPNE2EEConfiguration.ACTIVATION_SCOPE) {
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
    private getHeadersString(headers: Headers | undefined): string {
        let result = "Headers: {"
        headers?.forEach( (v: string, k: string) => {
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
