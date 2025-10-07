/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

/** 
 * Represents a PowerAuth-based API endpoint. 
 * 
 * Use static methods to create instances of this class: 
 * - `WPNEndpoint.signed(...)` for signed endpoints
 * - `WPNEndpoint.signedWithToken(...)` for signed endpoints with token
 * - `WPNEndpoint.unsigned(...)` for unsigned endpoints
 * 
 * @typeParam T Type of the expected response data. Use `void` if no data is expected.
 */
export class WPNEndpoint<TRequest, TResponse> {

    /**
     * Create signed endpoint that requires PowerAuth signature.
     * 
     * @param path Endpoint path, for example "/pa/myendpoint". Will be added to the base URL.
     * @param uriId URI ID used for signature calculation.
     * This is not necessarily the same as the path, but rather an identifier of the endpoint.
     * @param returnsData True if the endpoint is expected to return data in the response.
     * @param responseConfig Optional configuration for the response parsing.
     * @param e2eeConfig Optional configuration for end-to-end encryption (default is NOT_ENCRYPTED).
     *
     * @typeParam U Type of the expected response data. Use `void` if no data is expected.
     */
    static signed<TRequest, TResponse>(path: string, uriId: string, returnsData: boolean, responseConfig?: WPNResponseConfig, e2eeConfig?: WPNE2EEConfiguration): WPNEndpoint<TRequest, TResponse> {
        return new WPNEndpoint<TRequest, TResponse>(path, returnsData, responseConfig, uriId, undefined, e2eeConfig)
    }

    /**
     * Create signed endpoint that requires PowerAuth signature and token-based authentication.
     * 
     * @param path Endpoint path, for example "/pa/myendpoint". Will be added to the base URL.
     * @param tokenName Name of the token used for authentication, for example "myAuthToken".
     * @param returnsData True if the endpoint is expected to return data in the response.
     * @param responseConfig Optional configuration for the response parsing.
     * @param e2eeConfig Optional configuration for end-to-end encryption (default is NOT_ENCRYPTED).
     * 
     * @typeParam U Type of the expected response data. Use `void` if no data is expected.
     */
    static signedWithToken<TRequest, TResponse>(path: string, tokenName: string, returnsData: boolean, responseConfig?: WPNResponseConfig, e2eeConfig?: WPNE2EEConfiguration): WPNEndpoint<TRequest, TResponse> {
        return new WPNEndpoint<TRequest, TResponse>(path, returnsData, responseConfig, undefined, tokenName, e2eeConfig)
    }

    /**
     * Create unsigned endpoint that does not require any authentication.
     * 
     * @param path Endpoint path, for example "/pa/myendpoint". Will be added to the base URL.
     * @param returnsData True if the endpoint is expected to return data in the response.
     * @param responseConfig Optional configuration for the response parsing.
     * @param e2eeConfig Optional configuration for end-to-end encryption (default is NOT_ENCRYPTED).
     * 
     * @typeParam U Type of the expected response data. Use `void` if no data is expected.
     */
    static unsigned<TRequest, TResponse>(path: string, returnsData: boolean, responseConfig?: WPNResponseConfig, e2eeConfig?: WPNE2EEConfiguration): WPNEndpoint<TRequest, TResponse> {
        return new WPNEndpoint<TRequest, TResponse>(path, returnsData, responseConfig, undefined, undefined, e2eeConfig)
    }

    readonly method = "POST" // HTTP method for the request. We currently support only POST method.
    readonly path: string // Endpoint path, starting with a slash, for example "/pa/myendpoint"
    readonly returnsData: boolean // True if the endpoint is expected to return data in the response.
    readonly e2eeConfig: WPNE2EEConfiguration // Configuration for end-to-end encryption.
    readonly responseConfig?: WPNResponseConfig // Optional configuration for the response parsing.
    readonly uriId?: string // URI ID used for signature calculation. Only for signed endpoints.
    readonly tokenName?: string // Name of the token used for authentication. Only for signed-with-token endpoints.

    /** Type of the endpoint, based on whether it requires signature or token. */
    get type(): WPNEndpointType {
        if (this.uriId) {
            return WPNEndpointType.SIGNED
        } else if (this.tokenName) {
            return WPNEndpointType.SIGNED_WITH_TOKEN
        } else {
            return WPNEndpointType.UNSIGNED
        }
    }

    private constructor(path: string, returnsData: boolean, responseConfig?: WPNResponseConfig, uriId?: string, tokenName?: string, e2eeConfig: WPNE2EEConfiguration = WPNE2EEConfiguration.NOT_ENCRYPTED) {
        // Ensure that path starts with a slash
        this.path = (path.startsWith("/") ? path : ("/" + path))
        this.returnsData = returnsData
        this.responseConfig = responseConfig
        this.uriId = uriId
        this.tokenName = tokenName
        this.e2eeConfig = e2eeConfig
    }
}

/** Configuration for end-to-end encryption. */
export enum WPNE2EEConfiguration {
    /** Endpoint is encrypted with the application scope. */
    APPLICATION_SCOPE,
    /** Endpoint is encrypted with the activation scope. */
    ACTIVATION_SCOPE,
    /** Endpoint is not encrypted. */
    NOT_ENCRYPTED
}

/** Configuration for response parsing. */
export class WPNResponseConfig {
    /** List of fields in the response that should be parsed as dates. */
    readonly dateFields?: string[]

    /**
     * Create response configuration.
     * @param dateFields List of fields in the response that should be parsed as dates.
     */
    constructor(dateFields?: string[]) {
        this.dateFields = dateFields
    }
}

/** Type of the endpoint, based on whether it requires signature or token. */
export enum WPNEndpointType {
    SIGNED,
    SIGNED_WITH_TOKEN,
    UNSIGNED
}