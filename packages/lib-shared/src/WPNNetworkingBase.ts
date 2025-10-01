//
// Copyright 2025 Wultra s.r.o.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions
// and limitations under the License.
//

import { WPNKnownRestApiError } from "./WPNKnownRestApiError"
import { WPNException } from "./WPNException"
// import { PowerAuth, PowerAuthAuthentication } from 'react-native-powerauth-mobile-sdk'
import { WPNLogger, WPNLoggerVerbosity } from "./WPNLogger"
import { WPNUserAgent } from "./WPNUserAgent"
import { WPNEndpoint } from "./WPNEndpoint"

export type WPNRequestProcessor = (request: RequestInit) => RequestInit
export type WPNAuthToken = { key: string, value: string } | undefined

export abstract class WPNNetworkingBase {

    private _acceptLanguage = "en"

    /**
     * Returns accept language for the outgoing requests headers for `operations`, `push` and `inbox` objects.
     *
     */
    get acceptLanguage() {
        return this._acceptLanguage
    }

    /**
     * Sets accept language for the outgoing requests headers for `operations`, `push` and `inbox` objects.
     *
     * Default value is "en".
     *
     * Standard RFC "Accept-Language" https://tools.ietf.org/html/rfc7231#section-5.3.5
     * Response texts are based on this setting. For example when "de" is set, server
     * will return operation texts in german (if available).
     */
    set acceptLanguage(lang: string) {
        this._acceptLanguage = lang
        WPNLogger.info(`Accept language set to ${lang}.`)
    }

    /** @internal */
    userAgent: WPNUserAgent | string = WPNUserAgent.LIBRARY_DEFAULT

    private baseURL: string

    constructor(baseURL: string) {
        // Normalize base URL by removing trailing slash
        if (baseURL.endsWith("/")) {
            this.baseURL = baseURL.substring(0, baseURL.length - 1)
        } else {
            this.baseURL = baseURL
        }
    }

    protected async callInternal<T>(
        requestData: any, 
        endpoint: WPNEndpoint<T>,
        authHeaderProvider: (body: string) => Promise<WPNAuthToken>,
        requestProcessor?: WPNRequestProcessor
    ): Promise<WPNResponse<T>> {

        const url = this.baseURL + endpoint.path
        const body = JSON.stringify(requestData)
        const headers = new Headers()

        // Only JSON requests are supported
        const jsonType = "application/json"
        headers.set("Content-Type", jsonType)
        headers.set("Accept", jsonType)
        headers.set("Accept-Language", this._acceptLanguage)

        // Set User-Agent header
        if (this.userAgent == WPNUserAgent.LIBRARY_DEFAULT) {
            headers.set("User-Agent", await WPNUserAgent.getDefault())
        } else if (this.userAgent == WPNUserAgent.SYSTEM_DEFAULT) {
            // leave empty to default to system value
        } else {
            // Custom user agent string
            headers.set("User-Agent", this.userAgent)
        }

        // Add authentication header if available
        const authHeader = await authHeaderProvider(body)
        if (authHeader) {
            headers.set(authHeader.key, authHeader.value)
        }

        //const request = await wpnRequest.getRequestInit(this._acceptLanguage, this.userAgent, requestProcessor)
        let request: RequestInit = {
            method: endpoint.method,
            headers: headers,
            body: body
        }

        if (requestProcessor) {
            request = requestProcessor(request)
        }

        WPNLogger.info(` -> POST ${url}`)
        if (WPNLogger.verbosity >= WPNLoggerVerbosity.VERBOSE) {
            WPNLogger.verbose(this.getHeadersString(request.headers as Headers))
            WPNLogger.verbose(body)
        }

        let result = await fetch(url, request)
        let responseBody = await result.text()

        WPNLogger.info(` <- POST ${url} - ${result.status}`)

        if (WPNLogger.verbosity >= WPNLoggerVerbosity.VERBOSE) {
            WPNLogger.verbose(this.getHeadersString(result.headers))
            WPNLogger.verbose(responseBody)
        }

        let response = JSON.parse(responseBody, (key: string, value: any) => {

            // TODO: resolve nested date fields
            if (endpoint.dateFields?.includes(key)) {
                return new Date(value)
            }
            return value
        }) as WPNResponse<T>

        if (response.status == "ERROR") {
            if (response.responseObject == undefined) {
                throw new WPNException("Error retrieved but no error data", { ...result })
            }
            response.responseError = response.responseObject as any
            response.responseObject = undefined
        }

        if (response.status == "OK" && endpoint.returnsData && response.responseObject == undefined) {
            throw new WPNException("No data object retieved.", { ...result })
        }

        return response
    }

    private getHeadersString(headers: Headers | undefined): string {
        let result = "Headers: {"
        headers?.forEach( (v: string, k: string) => {
            result += ` "${k}:" "${v}",`
        })
        return result + "}"
    }
}

/** Response from the API. */
export interface WPNResponse<T> {
    status: "OK" | "ERROR"
    responseError?: WPNResponseError
    responseObject?: T
} 
  
/** Error object when error on the server happens. */
export interface WPNResponseError {
    code: WPNKnownRestApiError | string
    message: string
}
