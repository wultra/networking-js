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