---
name: code-review
description: Review pull requests in the PowerAuth Networking JS SDK repository. Use when reviewing TypeScript APIs, native bridges, transport security, serialization, compatibility, or release changes.
---

# networking-js review

Review the actual PR target, head, and current checkout before judging it. This repository's normal integration target is `develop`; do not assume a release branch from its name. Default to **approve**. Report only a concrete, reproducible defect introduced by the PR, with affected `path:line`, user/security impact, and a specific correction. Do not give style, formatting, or CI-process advice.

Never post, submit, or resolve anything on GitHub without explicit user approval. Any content that could be posted must start with `🤖`.

## Package and public-contract map

This Yarn workspace publishes two API-equivalent packages:

- `packages/lib-cordova/`: `cordova-powerauth-networking`, entry point `src/index.ts`, Cordova plugin metadata in `plugin.xml`.
- `packages/lib-rn/`: `react-native-powerauth-networking`, entry point `src/index.ts`.
- Shared public model and protocol code is in `packages/lib-shared/src/`; generated `lib/index.js` and `lib/index.d.ts` are package artifacts, not the source of a behavioral change.

The two entry points export `WPNEndpoint`, `WPNException`, `WPNKnownRestApiError`, `WPNResponse`, `WPNSDKVersion`, `WPNUserAgent`, `WPNLoggerVerbosity`/`WPNLoggerConfig`, platform `WPNNetworking`, and `WPNRequestProcessor`. Flag a changed export, type, constructor, Promise result, or platform asymmetry only when it breaks this published contract.

## Security-critical request path

Follow endpoint changes from `packages/lib-shared/src/WPNEndpoint.ts` through `WPNNetworkingBase.callInternal()` and the platform adapter (`lib-cordova/src/WPNCordovaNetworking.ts` or `lib-rn/src/WPNRNNetworking.ts`).

- `WPNEndpoint.signed(path, uriId, ...)` must preserve the URI ID and PowerAuth signature; `signedWithToken(path, tokenName, ...)` must preserve the configured token; `unsigned()` must not accidentally acquire or lose authentication.
- Preserve POST JSON serialization, `Content-Type`, `Accept`, `Accept-Language`, and user-agent behavior in `WPNNetworkingBase.ts`. A `WPNRequestProcessor` is synchronous: do not accept or silently ignore a Promise-returning processor.
- E2EE scope (`APPLICATION_SCOPE`, `ACTIVATION_SCOPE`, `NOT_ENCRYPTED`) determines encryptor selection. Signing is over the plaintext serialized request; encrypted request/response cryptograms and headers must remain paired with the same decryptor.
- Error responses may be plaintext when decryption fails. Preserve the narrow fallback that parses only an `ERROR` response, then rethrows the original decryption error otherwise.
- Do not expose request bodies, response bodies, authorization/signature/encryption headers, tokens, activation data, or cryptograms through changed logging. Verify JSON date-field parsing and `OK`/`ERROR` response mapping remain compatible.

Cordova imports of `cordova-powerauth-mobile-sdk` and `cordova` are deliberately stripped in `rollup.config.js` because plugins provide them at runtime. React Native externals are `react-native-powerauth-mobile-sdk` and `react-native`; flag a change that bundles or removes either runtime boundary.

## Release, docs, and validation

`rollup.config.js` produces both packages; `yarn packAll` is the focused packaging check. CI runs it through `.github/workflows/ci.yml`.

Release metadata is defined by `.prepare-release.json`: root `package.json`, both package manifests, `packages/lib-cordova/plugin.xml`, and `packages/lib-shared/src/WPNSDKVersion.ts`, plus the `README.md` changelog heading. For a release-to-`develop` transition, every declared SDK/package/plugin version must be `0.0.1-dev` (not a release value); retain coordinated release versions only on the release branch.

Treat `README.md` as public integration documentation: update its changelog and compatible PowerAuth dependency guidance when a public behavior, package requirement, or release changes. Flag grammar only in changed public README/API documentation and only when the PR base is not a release branch. Do not review grammar elsewhere.

Tests should cover a changed endpoint/authentication/E2EE/error branch in both applicable platform paths; build artifact churn alone is not evidence of a source fix.
