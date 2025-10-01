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

/** Known PowerAuth server error codes. */
export enum WPNKnownRestApiError {
    
    // COMMON ERRORS
    
    /** When unexpected error happened. */
    GenericError                     = "ERROR_GENERIC",
    
    /** General authentication failure (wrong password, wrong activation state, etc...) */
    AuthenticationFailure            = "POWERAUTH_AUTH_FAIL",
    /** Invalid request sent - missing request object in request */
    InvalidRequest                   = "INVALID_REQUEST",
    /** Activation is not valid (it is different from configured activation) */
    InvalidActivation                = "INVALID_ACTIVATION",
    /** Invalid application identifier is attempted for operation manipulation */
    InvalidApplication               = "INVALID_APPLICATION",
    /** Invalid operation identifier is attempted for operation manipulation */
    InvalidOperation                 = "INVALID_OPERATION",
    /** Error during activation */
    ActivationError                  = "ERR_ACTIVATION",
    /** Error in case that PowerAuth authentication fails */
    AuthenticationError              = "ERR_AUTHENTICATION",
    /** Error during secure vault unlocking */
    SecureVaultError                 = "ERR_SECURE_VAULT",
    /** Returned in case encryption or decryption fails */
    EncryptionError                  = "ERR_ENCRYPTION",
    
    // PUSH ERRORS
  
    /** Failed to register push notifications */
    PushRegistrationFailed           = "PUSH_REGISTRATION_FAILED",
  
    // OPERATIONS ERRORS
    
    /** Operation is already finished */
    OperationAlreadyFinished         = "OPERATION_ALREADY_FINISHED",
    /** Operation is already failed */
    OperationAlreadyFailed           = "OPERATION_ALREADY_FAILED",
    /** Operation is cancelled */
    OperationAlreadyCancelled        = "OPERATION_ALREADY_CANCELED",
    /** Operation is expired */
    OperationExpired                 = "OPERATION_EXPIRED",
    /** Operation authorization failed */
    OperationFailed                  = "OPERATION_FAILED",
  
    // ACTIVATION SPAWN ERRORS
    
    /// Unable to fetch activation code.
    ActivationCodeFailed             = "ACTIVATION_CODE_FAILED",

    // Following errors are not used in the current version of the library, keep them commented out, for now.
    
    // // IDENTITY ONBOARDING ERRORS
    
    // /// Onboarding process failed or failed to start
    // OnboardingFailed                 = "ONBOARDING_FAILED",
    // /// An onboarding process limit reached (e.g. too many reset attempts for identity verification or maximum error score exceeded).
    // OnboardingLimitReached           = "ONBOARDING_PROCESS_LIMIT_REACHED",
    // /// Too many attempts to start an onboarding process for a user.
    // OnboardingTooManyProcesses       = "TOO_MANY_ONBOARDING_PROCESSES",
    // /// Failed to resend onboarding OTP (probably requested too soon)
    // OnboardingOtpFailed              = "ONBOARDING_OTP_FAILED",
    // /// Document is invalid
    // InvalidDocument                  = "INVALID_DOCUMENT",
    // /// Document submit failed
    // DocumentSubmitFailed             = "DOCUMENT_SUBMIT_FAILED",
    // /// Identity verification failed
    // IdentityVerificationFailed       = "IDENTITY_VERIFICATION_FAILED",
    // /// Identity verification limit reached (e.g. exceeded number of upload attempts).
    // IdentityVerificationLimitReached = "IDENTITY_VERIFICATION_LIMIT_REACHED",
    // /// Verification of documents failed
    // DocumentVerificationFailed       = "DOCUMENT_VERIFICATION_FAILED",
    // /// Presence check failed
    // PresenceCheckFailed              = "PRESENCE_CHECK_FAILED",
    // /// Presence check is not enabled
    // PresenceCheckNotEnabled          = "PRESENCE_CHECK_NOT_ENABLED",
    // /// Maximum limit of presence check attempts was exceeded.
    // PresenceCheckLimitEached         = "PRESENCE_CHECK_LIMIT_REACHED",
    // /// Too many same requests
    // TooManyRequests                  = "TOO_MANY_REQUESTS",
    
    // // OTHER
    
    // /// Communication with remote system failed
    // RemoteCommunicationError         = "REMOTE_COMMUNICATION_ERROR"
  }
