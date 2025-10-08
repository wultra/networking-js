/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { WPNKnownRestApiError } from "./WPNKnownRestApiError"

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