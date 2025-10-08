# PowerAuth Networking JS SDK

> [!WARNING]
> This library is __"WORK IN PROGRESS"__

<!-- begin remove -->
<p align="center"><img src="docs/intro.jpg" alt="Wultra Networking JS SDK" width="100%" /></p>

<!--
[![npmrn](https://img.shields.io/npm/v/react-native-powerauth-networking?label=npm%3Areact-native)](https://www.npmjs.com/package/react-native-powerauth-networking) 
[![npmcordova](https://img.shields.io/npm/v/cordova-powerauth-networking?label=npm%3Acordova)](https://www.npmjs.com/package/cordova-powerauth-networking) 
![date](https://img.shields.io/github/release-date/wultra/networking-js) 
[![license](https://img.shields.io/github/license/wultra/networking-js)](LICENSE)
 -->
<!-- end -->

__Wultra PowerAuth Networking__ (WPN) is a high-level SDK built on top of our [PowerAuth Mobile JS SDK](https://github.com/wultra/react-native-powerauth-mobile-sdk) that enables request signing and encryption.

> [!NOTE]
> We currently support __REACT NATIVE__ and __APACHE CORDOVA__ development platforms.

<!-- begin box info -->
You can imagine the purpose of this SDK as an __HTTP layer (client) that enables request signing and encryption__ via PowerAuth SDK based on its recommended implementation.
<!-- end -->

<!--
We use this SDK in our other open-source projects that you can take inspiration for example in:  
- [Digital Onboarding SDK](https://github.com/wultra/digital-onboarding-apple/blob/develop/Sources/API/Networking.swift)  
- [Mobile Token SDK](https://github.com/wultra/mtoken-sdk-ios/blob/develop/WultraMobileTokenSDK/Operations/Service/WMTOperationsImpl.swift#L259)
 -->

## Documentation Content
- [SDK Integration](#sdk-integration)
- [Open Source Code](#open-source-code)
- [Initialization and Configuration](#initialization-and-configuration)
- [Endpoint Definition](#endpoint-definition)
- [Creating an HTTP request](#creating-an-http-request)
- [Raw Response Observer](#raw-response-observer)
- [Parallel Requests](#parallel-requests)
- [SSL validation](#ssl-validation)
- [JSON encoder and decoder](#json-encoder-and-decoder)
- [Error Handling](#error-handling)
- [Language Configuration](#language-configuration)
- [Logging](#logging)
- [Changelog](#changelog)

## SDK Integration

### Requirements

- React Native (0.73+) or Apache Cordova (>=12.0.0)
- [PowerAuth Mobile JS SDK](https://github.com/wultra/react-native-powerauth-mobile-sdk) needs to be implemented in your project

### PowerAuth JS SDK Dependency

The PowerAuth JS SDK is a required peer dependency of the SDK. You must install it in a compatible version. 

Defining it as a peer dependency ensures that only a single instance of the PowerAuth SDK is used in your project, preventing issues with multiple npm clones.

- For **React Native**, install both `react-native-powerauth-mobile-sdk` and `react-native-powerauth-networking` using `npm` or `yarn`.
- For **Cordova**, add `cordova-powerauth-networking` using the `cordova plugin add` command. The `cordova-powerauth-mobile-sdk` will be automatically installed as a dependency.

### Compatible PowerAuth Mobile JS SDK Versions

| WPN Version | PowerAuth JS SDK |
|-------------|------------------|
| `1.0.x`     | `^4.1.0`         |

### React Native Installation

#### Supported Platforms

The library is available for the following __React Native (0.73+)__ platforms:

- __Android 5.0 (API 21)__ and newer
- __iOS 13.4__ and newer

#### How To Install

##### 1. Install packages via npm
```sh
# if not added yet, add powerauth mobile SDK first (compatible versions are at the top of this document)
npm i react-native-powerauth-mobile-sdk --save
npm i react-native-powerauth-networking --save
```

##### 2. Install pods for iOS (if needed)

To make integration work with iOS, you might need to install Pods (needed for PowerAuth):

```sh
cd ios
pod install
```

### Cordova Installation

#### Supported Platforms

The library is available for the following __Apache Cordova (>=12.0.0)__ platforms:

- __Android 7.0 (API 24)__ and newer (cordova-android version >=12.0.0)
- __iOS 11.0__ and newer (cordova-ios version >=7.0.0)

#### How To Install

#### 1. Install plugin via the Cordova plugin installer
```sh
cordova plugin add cordova-powerauth-networking
```

#### 2. Install pods for iOS (if needed)

To make integration work with iOS, you might need to install Pods (needed for PowerAuth):

```sh
cd platforms/ios
pod install
```

## Open Source Code

The code of the library is open source and you can freely browse it in our GitHub at [https://github.com/wultra/networking-js](https://github.com/wultra/networking-js/#docucheck-keep-link)

## Initialization and Configuration

Everything you need is packed inside the single `WPNNetworking` class that provides all the necessary APIs for your networking.

To successfully create an instance of the service, you need only 2 things:  
- configured `PowerAuthSDK` object  
- configuration of the service (like endpoints base URL)

<!-- begin box info -->
You can create as many instances of the class as you need for your usage.
<!-- end -->

Example:

```typescript
let pa: PowerAuth = ... // your PowerAuthSDK instance
let baseURL = "https://my.backend.com/api/v3" // whene undefined, powerauth url will be used
const networking = new WPNNetworking(pa, baseURL)
```

## Endpoint Definition

Each endpoint you will target with your project must be defined for the service as a `WPNEndpoint` instance. There are several types of endpoints based on the PowerAuth signature that is required.

### End To End Encryption

If the endpoint is end-to-end encrypted, you need to configure it accordingly. Default values are set to `NOT_ENCRYPTED`.

Possible values are:
```typescript
/** Configuration for end-to-end encryption. */
export enum WPNE2EEConfiguration {
    /** Endpoint is encrypted with the application scope. */
    APPLICATION_SCOPE,
    /** Endpoint is encrypted with the activation scope. */
    ACTIVATION_SCOPE,
    /** Endpoint is not encrypted. */
    NOT_ENCRYPTED
}
```

<!-- begin box info -->
Whether an endpoint is encrypted or not is based on its backend definition.
<!-- end -->

### Signed endpoint `WPNEndpoint.signed()`

For endpoints that are __signed__ by a PowerAuth signature and can be end-to-end encrypted.

Example:
```typescript
// signed endpoint with expected response data, not response config and end-to-end encryption disabled
const mySignedEndpoint: WPNEndpoint<MyRequest, MyResponse> = WPNEndpoint.signed("/path/to/the/signed/endpoint", "endpoint/identifier", undefined, WPNE2EEConfiguration.NOT_ENCRYPTED)
```

### Signed endpoint with Token `WPNEndpoint.signedWithToken()`

For endpoints that are __signed by token__ by PowerAuth signature and can be end-to-end encrypted.

More info for token-based authentication [can be found here](https://github.com/wultra/powerauth-mobile-sdk/blob/develop/docs/PowerAuth-SDK-for-iOS.md#token-based-authentication)

Example:
```typescript
// signed endpoint with token-based authentication with expected response data, not response config and end-to-end encryption disabled
const myTokenSignedEndpoint: WPNEndpoint<MyRequest, MyResponse> = WPNEndpoint.signedWithToken("/path/to/the/signed/endpoint", "tokenName", undefined, WPNE2EEConfiguration.NOT_ENCRYPTED)

// tokenName is the name of the token as stored in the PowerAuthSDK
// more info can be found in the PowerAuthSDK documentation
// https://github.com/wultra/powerauth-mobile-sdk/blob/develop/docs/PowerAuth-SDK-for-iOS.md#token-based-authentication

```

### Basic endpoint (not signed) `WPNEndpoint.unsigned`

For endpoints that are __not signed__ by PowerAuth signature but can be end-to-end encrypted.

Example:
```typescript
// unsigned endpoint with expected response data, not response config and end-to-end encryption set to application scope
const myTokenSignedEndpoint: WPNEndpoint<MyRequest, MyResponse> = WPNEndpoint.unsigned("/path/to/the/signed/endpoint", undefined, WPNE2EEConfiguration.APPLICATION_SCOPE)
```

## Creating an HTTP request

To create an HTTP request to your endpoint, you need to call the `WPNNetworking.call` method with the following parameters:

- `endpoint` - an endpoint that will be called
- `requestData` - request data that will be sent to the server
- `authentication` - `PowerAuthAuthentication` instance that will sign the request (if needed)
  - pass `undefined` for the basic `unsigned` endpoint
- `requestProcessor` - optional request processor that can modify the request before it is sent to the server

The method is asynchronous and returns a `Promise` with the response or an error.

Example:
```typescript
// payload we will send to the server
interface MyRequest {
    userID: string
}

// response of the server
interface MyResponse {
    name: string
    email: string
}

// endpoint configuration
const endpoint: WPNEndpoint<MyRequest, MyResponse> = WPNEndpoint.signed("/path/to/the/signed/endpoint", "endpoint/identifier", true, undefined, WPNE2EEConfiguration.ACTIVATION_SCOPE)

// Authentication (for example purposes) expect user PIN 1111
const auth = PowerAuthAuthentication.password("1111)
            
// WPNNetworkingService instance call
const response = await networking.call(
    // specify endpoint
    endpoint,
    // specify request data
    { userID: "12345" },
    // specify authentication
    auth
)

if (response.status == "OK" && response.responseObject) {
    // success, use response.responseObject
    console.log(`User name is ${response.responseObject.name} and email is ${response.responseObject.email}`)
} else {
    // error, use response.error
    console.error(`Error: ${response.error}`)
}

```

We use `fetch` under the hood.

## Server Errors

When a server returns an error, the `WPNResponse` object will contain the error information in the `responseError` property. The `status` property will be set to `"ERROR"`.

The `responseError` object will contain a code and a message that can be used to identify the error.

This is a known server codes:

| Enum Value                  | Description                                                                 |
|-----------------------------|-----------------------------------------------------------------------------|
| `GenericError`              | Generic error without specific reason                                       |
| `AuthenticationFailure`     | General authentication failure (wrong password, wrong activation state, etc...) |
| `InvalidRequest`            | Invalid request sent - missing request object in request                    |
| `InvalidActivation`         | Activation is not valid (it is different from configured activation)        |
| `InvalidApplication`        | Invalid application identifier is attempted for operation manipulation      |
| `InvalidOperation`          | Invalid operation identifier is attempted for operation manipulation        |
| `ActivationError`           | Error during activation                                                     |
| `AuthenticationError`       | Error in case that PowerAuth authentication fails                           |
| `SecureVaultError`          | Error during secure vault unlocking                                         |
| `EncryptionError`           | Returned in case encryption or decryption fails                             |
| `PushRegistrationFailed`    | Failed to register push notifications                                       |
| `OperationAlreadyFinished`  | Operation is already finished                                               |
| `OperationAlreadyFailed`    | Operation is already failed                                                 |
| `OperationAlreadyCancelled` | Operation is cancelled                                                      |
| `OperationExpired`          | Operation is expired                                                        |
| `OperationFailed`           | Operation authorization failed                                              |
| `ActivationCodeFailed`      | Unable to fetch activation code                                             |

## Language Configuration

Before using any methods from this SDK that call the backend, a proper language should be set. A properly translated content is served based on this configuration. The property that stores language settings __does not persist__. You need to set `acceptLanguage` every time that the application boots.

<!-- begin box warning -->
Note: Content language capabilities are limited by the implementation of the server - it must support the provided language.
<!-- end -->

### Format

The default value is always `en`. With other languages, we use values compliant with standard RFC [Accept-Language](https://tools.ietf.org/html/rfc7231#section-5.3.5).

## Logging

You can set up logging for the library using the `WPNLoggerConfig` class.

### Verbosity Level

You can limit the amount of logged information via the `verbosity` property.

| Level                  | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `NONE`                 | Silences all logs.                                |
| `ERROR`                | Only errors will be logged.                       |
| `WARN` _(default)_     | Errors and warnings will be logged.               |
| `INFO`                 | Error, warning and info messages will be logged.  |
| `VERBOSE`              | All but debug messages will be printed into the console. |
| `DEBUG`                | All messages will be logged.                      |

### Log Time

You can enable or disable time logging via the `includeTime` property. The default value is `true`.

### Logger Listener

In case you want to process logs on your own (for example log into a file or some cloud service), you can set `WPNLoggerConfig.listener`.

## Changelog

### 1.0.0

- Initial release

<!-- begin remove -->
## Web Documentation

This documentation is also available at the [Wultra Developer Portal](https://developers.wultra.com/).

## License

All sources are licensed using the Apache 2.0 license. You can use them with no restrictions. If you are using this library, please let us know. We will be happy to share and promote your project.

## Contact

If you need any assistance, do not hesitate to drop us a line at [hello@wultra.com](mailto:hello@wultra.com) or our official [wultra.com/discord](https://wultra.com/discord) channel.

### Security Disclosure

If you believe you have identified a security vulnerability with this SDK, you should report it as soon as possible via email to [support@wultra.com](mailto:support@wultra.com). Please do not post it to a public issue tracker.
<!-- end -->
