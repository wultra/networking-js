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

    private baseURL: string

    protected constructor(baseURL: string, acceptLanguage?: string, userAgent?: WPNUserAgent | string) {
        // Normalize base URL by removing trailing slash
        if (baseURL.endsWith("/")) {
            this.baseURL = baseURL.substring(0, baseURL.length - 1)
        } else {
            this.baseURL = baseURL
        }
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
        const url = this.baseURL + endpoint.path
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

        // Add authentication header if available
        let authHeader: WPNAuthToken = undefined

        // Ensure that authentication object is provided for signed requests
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
        const encryptResult = await this.encryptRequest(requestSerialized, endpoint)

        if (encryptResult.header) {
            // Add encryption header if available
            headers.set(encryptResult.header.key, encryptResult.header.value)
        }

        // Create the request object
        let request: RequestInit = {
            method: endpoint.method,
            headers: headers,
            body: encryptResult.body
        }

        // Allow request processor to modify the request
        if (requestProcessor) {
            request = requestProcessor(request)
        }

        WPNLogger.info(` -> ${endpoint.method} ${url}`)
        if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
            WPNLogger.verbose(this.getHeadersString(request.headers as Headers))
            WPNLogger.verbose(requestSerialized)
            if (encryptResult.body !== requestSerialized) {
                WPNLogger.verbose("ENCRYPTED BODY: " + encryptResult.body)
            }
        }

        // Fetch the result and get the response
        const result = await fetch(url, request)
        const responseBody = await result.text()

        // Decrypt the response if needed
        try {
            const decryptedResponse = await encryptResult.decryptor(responseBody)

            WPNLogger.info(` <- ${endpoint.method} ${url} - ${result.status}`)
            if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
                WPNLogger.verbose(this.getHeadersString(result.headers))
                WPNLogger.verbose(decryptedResponse)
                if (decryptedResponse !== responseBody) {
                    WPNLogger.verbose("ENCRYPTED RESPONSE: " + responseBody)
                }
            }

            return this.parseResponse(decryptedResponse, endpoint, result)
        } catch (e) {
            WPNLogger.error(`Failed to decrypt response from ${endpoint.method} ${url}. Falling back to plain response parsing.`)
            try {
                // error responses might not be encrypted, so try to parse the response as a plain, but only for error responses
                const plainResponse = this.parseResponse<TResponse>(JSON.parse(responseBody), endpoint, result)
                if (plainResponse.status == "ERROR") {
                    return plainResponse
                }
            } catch {
                // ignore parsing errors
            }
            throw e // rethrow original exception
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

    /** Encrypt request body if needed. */
    private async encryptRequest<TRequest, TResponse>(body: string, endpoint: WPNEndpoint<TRequest, TResponse>): Promise<EncryptorResult> {
        
        // Get encryptor for the endpoint
        const encryptor = this.getEncryptor(endpoint)
        if (!encryptor) {
            // No encryption, return plain body and decryptor that does nothing
            return { 
                body: body, 
                header: undefined, 
                decryptor: async (data: string) => data 
            }
        }
        // Encrypt the body
        const encrypted = await encryptor.encryptRequest(body)
        let header: WPNAuthToken = undefined
        // If the endpoint is unsigned, use the header from the encrypted response
        if (endpoint.type !== WPNEndpointType.SIGNED) {
            header = encrypted.header
        }
        // Return the cryptogram JSON string, header and decryptor
        return { 
            body: JSON.stringify(encrypted.cryptogram), 
            header: header, 
            decryptor: (responseBody) => encrypted.decryptor.decryptResponse(JSON.parse(responseBody)) 
        }
    }

    /** 
     * Get encryptor for the specified endpoint, if end-to-end encryption is enabled. 
     * 
     * Actual implementation expects to retrieve encryptor from PowerAuth instance.
     */
    protected abstract getEncryptor<TRequest, TResponse>(endpoint: WPNEndpoint<TRequest, TResponse>): WPNEncryptor | undefined

    // Helper to convert headers to string for logging
    private getHeadersString(headers: Headers | undefined): string {
        let result = "Headers: {"
        headers?.forEach( (v: string, k: string) => {
            result += ` "${k}:" "${v}",`
        })
        return result + "}"
    }
}

// Result of the encryption operation
interface EncryptorResult {
    body: string // Body to be sent to the server (plain or encrypted)
    header: WPNAuthToken // Optional header to be added to the request
    decryptor: (responseBody: string) => Promise<string> // Function to decrypt the response body
}

// Abstract interface that conforms to PowerAuthEncryptor
export interface WPNEncryptor {
    encryptRequest(body: string): Promise<WPNEncryptedRequestData>
}

// Abstract interface that conforms to PowerAuthDecryptor
export interface WPNDecryptor {
    decryptResponse(cryptogram: any): Promise<string>
}

// Structure returned by WPNEncryptor
export interface WPNEncryptedRequestData {
    readonly cryptogram: any // Cryptogram that will be transformed to JSON
    readonly header: WPNAuthToken
    readonly decryptor: WPNDecryptor
}
