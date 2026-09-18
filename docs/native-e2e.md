# PowerAuth 5.0.0-beta-1 native E2E verification

The automated `yarn test` suite covers networking behavior in both published JavaScript bundles and real local HTTP transport. PowerAuth returns fixed stub responses; the tests verify how the networking SDK uses them, not PowerAuth authentication or cryptography. This repository has no host applications, activation configuration, or enrollment/test backend credentials, so native Android/iOS E2E verification must be performed in configured React Native and Cordova host applications before release.

Use the exact beta assets in the README, PowerAuth native SDK 2.0.0, and a compatible backend. Run each scenario on Android and iOS in both frameworks. Record device/OS, backend protocol, and SDK versions. Do not put credentials or activation secrets in the repository.

1. Configure PowerAuth, create/restore an activation, and construct `WPNNetworking` both with an explicit URL and without one. Confirm implicit URL lookup succeeds and an unconfigured instance rejects the call.
2. Call unsigned, signed (possession and password), and token-authenticated endpoints without E2EE. Verify backend authentication succeeds and the response object and error mapping are unchanged.
3. Repeat all three endpoint kinds with application-scope and activation-scope E2EE, using supported backend routes. Verify the backend accepts plaintext authentication with the encrypted transport body and the matching response decrypts. Include non-ASCII text and emoji in both directions.
4. Return an unencrypted `ERROR` envelope for an encrypted request. Confirm its error code/message are returned. Return plaintext `OK` and a corrupted encrypted response; both must reject rather than accept unauthenticated success.
5. Exercise canceled/failed authentication, a throwing request processor, connection failure, and failed decryption. Check native object diagnostics for released encryptors, then confirm a new request succeeds with a fresh encryptor.
6. Issue concurrent encrypted calls with different responses and confirm each response uses its own encryptor. Verify token acquisition and subsequent reuse against the backend.

Native E2E status for this change: **BLOCKED** until these scenarios run with a configured host and backend. Local packaging and bridge-boundary tests are not substitutes for these checks.
