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

import { WPNResponse } from "./WPNResponse"
import { WPNException } from "./WPNException"
import { WPNLogger, WPNLoggerConfig, WPNLoggerVerbosity } from "./WPNLogger"
import { WPNUserAgent, WPNUserAgentUtils } from "./WPNUserAgent"
import { WPNEndpoint } from "./WPNEndpoint"

/** Function to process requests before sending */
export type WPNRequestProcessor = (request: RequestInit) => RequestInit
/** Authentication token to be added to the request headers */
export type WPNAuthToken = { key: string, value: string } | undefined

/** Base class for networking implementations. */
export abstract class WPNNetworkingBase {

    private _acceptLanguage = "en"

    /** Returns accept language for the outgoing requests headers for `operations`, `push` and `inbox` objects. */
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

        // prepare URL, body and headers
        const url = this.baseURL + endpoint.path
        const body = JSON.stringify(requestData)
        const headers = new Headers()

        const jsonType = "application/json" // Only JSON requests are supported
        headers.set("Content-Type", jsonType)
        headers.set("Accept", jsonType)
        headers.set("Accept-Language", this._acceptLanguage)

        // Set User-Agent header
        const userAgent = await WPNUserAgentUtils.get(this.userAgent);
        if (userAgent) {
            headers.set("User-Agent", userAgent);
        }

        // Add authentication header if available
        const authHeader = await authHeaderProvider(body)
        if (authHeader) {
            headers.set(authHeader.key, authHeader.value)
        }

        // Create the request object
        let request: RequestInit = {
            method: endpoint.method,
            headers: headers,
            body: body
        }

        // Allow request processor to modify the request
        if (requestProcessor) {
            request = requestProcessor(request)
        }

        WPNLogger.info(` -> POST ${url}`)
        if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
            WPNLogger.verbose(this.getHeadersString(request.headers as Headers))
            WPNLogger.verbose(body)
        }

        // Fetch the result and get the response
        let result = await fetch(url, request)
        let responseBody = await result.text()

        WPNLogger.info(` <- POST ${url} - ${result.status}`)
        if (WPNLoggerConfig.verbosity >= WPNLoggerVerbosity.VERBOSE) {
            WPNLogger.verbose(this.getHeadersString(result.headers))
            WPNLogger.verbose(responseBody)
        }

        // parse the response
        let response = JSON.parse(responseBody, (key: string, value: any) => {

            // TODO: resolve nested date fields
            if (endpoint.responseConfig?.dateFields?.includes(key)) {
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

        } else if (response.status == "OK" && endpoint.returnsData && response.responseObject == undefined) {
            // If the endpoint is expected to return data, but no data object is present, throw an exception
            throw new WPNException("No data object retieved.", { ...result })
        }

        return response
    }

    // Helper to convert headers to string for logging
    private getHeadersString(headers: Headers | undefined): string {
        let result = "Headers: {"
        headers?.forEach( (v: string, k: string) => {
            result += ` "${k}:" "${v}",`
        })
        return result + "}"
    }
}
