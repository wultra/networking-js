/**
 * Copyright Wultra s.r.o.
 *
 * This source code is licensed under the Apache License, Version 2.0 license
 * found in the LICENSE file in the root directory of this source tree.
 */

/** Possible logic errors during the API calls. */
export class WPNException {

    /** Description of the Exception. */
    description: string
    /** Optional additional data that helps with the exception. */
    additionalData?: any
    
    constructor(description: string, additionalData?: any) {
      this.description = description
      this.additionalData = additionalData
    }
  }

/** The call was cancelled with the `signal` passed in `WPNCallOptions`. */
export class WPNCancelledException extends WPNException {

    /** The abort reason of the signal, if the platform provides it. */
    readonly reason?: any

    constructor(reason?: any) {
        super("WPNNetworking: Request was cancelled.", reason)
        this.reason = reason
    }
}

/** The server did not respond within the configured timeout. */
export class WPNTimeoutException extends WPNException {

    /** The timeout that elapsed, in milliseconds. */
    readonly timeout: number

    constructor(timeout: number) {
        super(`WPNNetworking: Request timed out after ${timeout} ms.`, { timeout })
        this.timeout = timeout
    }
}
