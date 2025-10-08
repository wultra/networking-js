/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNE2EEConfiguration, WPNEndpoint, WPNEndpointType } from '../../lib-shared/src/WPNEndpoint'
import { WPNException } from '../../lib-shared/src/WPNException'
import { WPNResponse } from '../../lib-shared/src/WPNResponse'
import { WPNUserAgent } from '../../lib-shared/src/WPNUserAgent'
import { WPNEncryptor, WPNNetworkingBase, WPNRequestProcessor } from '../../lib-shared/src/WPNNetworkingBase'
import "cordova-powerauth-mobile-sdk"

/** Networking service for dispatching PowerAuth signed requests. */
export class WPNNetworking extends WPNNetworkingBase {
    
    private pa: PowerAuth

    /**
     * @param pa PowerAuth instance
     * @param baseURL Base URL for the networking service (usually https://<your-server>/enrollment-server/)
     * If not provided, the base URL is taken from PowerAuth configuration (if available).
     * @param acceptLanguage Accept language for the outgoing requests headers. Default is "en" when not set.
     * @param userAgent User-Agent string for the outgoing requests headers. Default is `WPNUserAgent.LIBRARY_DEFAULT` when not set.
     * @throws WPNException when baseURL is not provided and it cannot be taken from PowerAuth configuration.
     */
    constructor(pa: PowerAuth, baseURL: string | undefined = undefined, acceptLanguage?: string, userAgent?: WPNUserAgent | string) {
        const url = baseURL || pa.configuration?.baseEndpointUrl
        if (!url) {
            throw new WPNException("WPNNetworking: Base URL not provided.")
        }
        super(url, acceptLanguage, userAgent)
        this.pa = pa
    }

    /** Dispatches a request to the specified endpoint.
     * 
     * **Parameters:**
     * @param endpoint Endpoint definition
     * @param requestData Request data object, will be serialized to JSON
     * @param authentication PowerAuthAuthentication object defining authentication factors to be used, or undefined for unsigned requests
     * If the endpoint is signed and authentication is not provided, an exception is thrown.
     * @param requestProcessor Optional request processor, used for custom modification of the request before it is sent
     *
     * **Type Parameters:**
     * @param TRequest Type of the request data
     * @param TResponse Type of the response data. Note that the response data are not actually typed, because they are deserialized from JSON to `any`. Use `void` if no data is expected.
     *
     * **Returns:**
     * @returns Response object deserialized from JSON
     * 
     * **Throws:**
     * @throws WPNException when an internal error occurs
     * @throws WPNKnownRestApiError when a known REST API error is returned from the server
     */
    call<TRequest, TResponse>(
        endpoint: WPNEndpoint<TRequest, TResponse>,
        requestData: TRequest, 
        authentication: PowerAuthAuthentication | undefined,
        requestProcessor: WPNRequestProcessor | undefined = undefined
    ): Promise<WPNResponse<TResponse>> {
        // Ensure that authentication object is provided for signed requests
        if (!authentication && endpoint.type !== WPNEndpointType.UNSIGNED) {
            throw new WPNException("WPNNetworking: Authentication object not provided for signed request.")
        }

        return this.callInternal(
            requestData,
            endpoint,
            // Signing function
            body => this.pa.requestSignature(authentication!, endpoint.method, endpoint.uriId!, body),
            // Signing with token function
            () => this.pa.tokenStore.requestAccessToken(endpoint.tokenName!, authentication!).then(token => this.pa.tokenStore.generateHeaderForToken(token.tokenName)),
            requestProcessor
        )
    }

    /** Get encryptor for the specified endpoint, if end-to-end encryption is enabled. */
    protected getEncryptor<TRequest, TResponse>(endpoint: WPNEndpoint<TRequest, TResponse>): WPNEncryptor | undefined {
        if (endpoint.e2eeConfig === WPNE2EEConfiguration.NOT_ENCRYPTED) {
            return undefined
        } else if (endpoint.e2eeConfig === WPNE2EEConfiguration.ACTIVATION_SCOPE) {
            return this.pa.getEncryptorForActivationScope()
        } else {
            return this.pa.getEncryptorForApplicationScope()
        }
    }
}