# PowerAuth Networking JS SDK

> [!WARNING]
> This library is __"WORK IN PROGRESS"__

<!-- begin remove -->
<p align="center"><img src="docs/intro.jpg" alt="Wultra Networking f" width="100%" /></p>

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
- For **Cordova**, add both `cordova-powerauth-mobile-sdk` and `cordova-powerauth-networking` using the `cordova plugin add` command.

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

#### 1. Install plugins via the Cordova plugin installer
```sh
# if not added yet, add powerauth mobile SDK first (compatible versions are at the top of this document)
cordova plugin add cordova-powerauth-mobile-sdk
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

TODO: !! rewrite to TS
```swift
const networking = WPNNetworkingService(
    powerAuth: myPowerAuthInstance, // configured PowerAuthSDK instance
    config: WPNConfig(
        baseUrl: "https://sandbox.company.com/my-service", // URL to my PowerAuth based service
        sslValidation: .default, // use default SSL error handling (more in SSL validation docs section)
        timeoutIntervalForRequest: 10, // give 10 seconds for the server to respond
        userAgent: .libraryDefault // use library default HTTP User-Agent header
        
    ), 
    serviceName: "MyProjectNetworkingService", // for better debugging
    acceptLanguage: "en" // more info in "Language Configuration" docs section
)
```

## Endpoint Definition

Each endpoint you will target with your project must be defined for the service as a `WPNEndpoint` instance. There are several types of endpoints based on the PowerAuth signature that is required.

### End To End Encryption

If the endpoint is end-to-end encrypted, you need to configure it in the init. Default initializers are set to `NOT_ENCRYPTED`. 

Possible values are:
TODO: !! rewrite to TS
```swift
/// Endpoint configuration for end to end encryption.
public enum WPNE2EEConfiguration {
    /// Endpoint is encrypted with the application scope.
    case applicationScope
    /// Endpoint is encrypted with the activation scope.
    case activationScope
    /// Endpoint is not encrypted.
    case notEncrypted
}
```

<!-- begin box info -->
Whether an endpoint is encrypted or not is based on its backend definition.
<!-- end -->

### Signed endpoint `WPNEndpointSigned`

For endpoints that are __signed__ by a PowerAuth signature and can be end-to-end encrypted.

Example:
TODO: !! rewrite to TS
```swift
typealias MySignedEndpointType = WPNEndpointSigned<WPNRequest<MyEndpointDataRequest>, WPNResponse<MyEndpointDataResponse>>
var mySignedEndpoint: MySignedEndpointType { WPNEndpointSigned(endpointURLPath: "/additional/path/to/the/signed/endpoint", uriId: "endpoint/identifier", e2ee: .notEncrypted) }
// uriId is defined by the endpoint issuer - ask your server developer/provider

```

### Signed endpoint with Token `WPNEndpointSignedWithToken`

For endpoints that are __signed by token__ by PowerAuth signature and can be end-to-end encrypted.

More info for token-based authentication [can be found here](https://github.com/wultra/powerauth-mobile-sdk/blob/develop/docs/PowerAuth-SDK-for-iOS.md#token-based-authentication)

Example:
TODO: !! rewrite to TS
```swift
typealias MyTokenEndpointType = WPNEndpointSignedWithToken<WPNRequest<MyEndpointDataRequest>, WPNResponse<MyEndpointDataResponse>>
var myTokenEndpoint: MyTokenEndpointType { WPNEndpointSignedWithToken(endpointURLPath: "/additional/path/to/the/token/signed/endpoint", tokenName: "MyToken", e2ee: .notEncrypted) }

// tokenName is the name of the token as stored in the PowerAuthSDK
// more info can be found in the PowerAuthSDK documentation
// https://github.com/wultra/powerauth-mobile-sdk/blob/develop/docs/PowerAuth-SDK-for-iOS.md#token-based-authentication

```

### Basic endpoint (not signed) `WPNEndpointBasic`

For endpoints that are __not signed__ by PowerAuth signature but can be end-to-end encrypted.

Example:
TODO: !! rewrite to TS
```swift
typealias MyBasicEndpointType = WPNEndpointBasic<WPNRequest<MyEndpointDataRequest>, WPNResponse<MyEndpointDataResponse>>
var myBasicEndpoint: MyBasicEndpointType { WPNEndpointBasic(endpointURLPath: "/additional/path/to/the/basic/endpoint", e2ee: .notEncrypted) }

```

## Creating an HTTP request

TODO: !! update with actual API

To create an HTTP request to your endpoint, you need to call the `WPNNetworking.post` method with the following parameters:

- `data` - with the payload of your request
- `auth` - `PowerAuthAuthentication` instance that will sign the request  
  - this parameter is missing for the basic endpoint 
- `endpoint` - an endpoint that will be called
- `headers` - custom HTTP headers, `nil` by default
- `timeoutInterval` - timeout interval, `nil` by default. When `nil`, the default configured in `WPNConfig` will be used
- `progressCallback` - callback with percentage progress (values between 0 and 1)
- `completionQueue` - queue that the completion will be called on (main queue by default)
- `completion` - result completion


Example:
TODO: !! rewrite to TS
```swift
// payload we will send to the server
struct MyRequestPayload {
    let userID: String
}

// response of the server
struct MyResponse {
    let name: String
    let email: String
}

// endpoint configuration
typealias MyEndpointType = WPNEndpointSigned<WPNRequest<MyRequestPayload>, WPNResponse<MyResponse>>
var endpoint: MyEndpointType { WPNEndpointSigned(endpointURLPath: "/path/to/myendpoint", uriId: "myendpoint/identifier") }

// Authentication (for example purposes) expect user PIN 1111
let auth = PowerAuthAuthentication.possessionWithPassword("1111")
            
// WPNNetworkingService instance call
networking.post(
    // create request data
    data: MyEndpointType.RequestData(.init(userID: "12345")),
    // specify endpoint
    to: endpoint,
    // custom HTTP headers
    with: ["MyCustomHeader": "Value"],
    // only wait 10 seconds at max
    timeoutInterval: 10,
    // handle response or error
    completion: { result, error in
        if let data = result?.responseObject {
            // we have data
        } else {
            // handle error or empty response
        }
    }
)

```

We use systems `URLSession` under the hood.

## Raw Response Observer

All responses can be observed with `WPNResponseDelegate` in `WPNNetworkingService.responseDelegate`.

An example implementation of the delegate:

```swift
class MyResponseDelegateLogger: WPNResponseDelegate {
    
    func responseReceived(from url: URL, statusCode: Int?, body: Data) {
        print("Response received from \(url) with status code \(statusCode) and data:")
        print(String(data: body, encoding: .utf8) ?? "")
    }
    
    // for endpoints that are end-to-end encrypted
    func encryptedResponseReceived(from url: URL, statusCode: Int?, body: Data, decrypted: Data) {
        print("Encrypted response received from \(url) with status code \(statusCode) and: ")
        print("    Raw data:")
        print(String(data: body, encoding: .utf8) ?? "")
        print("    Decrypted data:")
        print(String(data: decrypted, encoding: .utf8) ?? "")
    }
}
```

## Parallel Requests

By default, the SDK is serializing all signed requests. This means that the requests signed with the PowerAuthSDK are put into the queue and executed one by one (meaning that the HTTP request is not made until the previous one is finished). Other requests will be parallel.

This behavior can be changed via `WPNNetworkingService.concurrencyStrategy` with the following possible values:

- `serialSigned` - Default behavior. Only requests that need a PowerAuth signature will be put into the serial queue that is shared with the `PowerAuthSDK` instance to ensure all signed requests are in proper order.
- `concurrentAll` - All requests will be put into the concurrent queue. This behavior is not recommended unless you know exactly why you want this.

<!-- begin box info -->
More about this topic can be found in the [PowerAuth documentation](https://developers.wultra.com/components/powerauth-mobile-sdk/develop/documentation/PowerAuth-SDK-for-iOS#request-synchronization).
<!-- end -->

## JSON encoder and decoder

SDK uses `JSONEncoder` and `JSONDecoder` with `iso8601` date strategies by default.

If the default does not suit your needs, you can set up your own decoder/encoder instances to the `jsonEncoder` and `jsonDecoder` properties in the `WPNNetworkingService` that will be used for all outbound and inbound traffic.

For more info about the JSON encoding and decoding, visit official [Apple documentation](https://developer.apple.com/documentation/foundation/archives_and_serialization/using_json_with_custom_types).

## SSL validation

The SDK uses default system handling of the SSL errors. To be able to ignore SSL errors (for example when your test server does not have a valid SSL certificate) or implement your own SSL pinning, you can configure `WPNConfig.sslValidation` property to get your desired behavior.

Possible values are:

- `default` - Uses default URLSession handling.
- `noValidation` - Trust HTTPS connections with invalid certificates.
- `sslPinning(_ provider: WPNPinningProvider)` - Validates the server certificate with your own logic.

## Error Handling

Every error produced by this library is of a `WPNError` type. This error contains the following information:

- `reason` - A specific reason, why the error happened. For more information see [WPNErrorReason chapter](#wpnerrorreason).
- `nestedError` - Original exception/error (if available) that caused this error.
- `httpStatusCode` - If the error is a networking error, this property will provide the HTTP status code of the error.
- `httpUrlResponse` - If the error is a networking error, this will hold the original HTTP response that was received from the backend.
- `restApiError` - If the error is a "well-known" API error, it will be filled here. For all available codes follow [the source code](https://github.com/wultra/networking-apple/blob/develop/Sources/WultraPowerauthNetworking/WPNBaseNetworkingObjects.swift#L130#docucheck-keep-link).
- `networkIsNotReachable` - Convenience property, informs about a state where the network is unavailable (based on the error type).
- `networkConnectionIsNotTrusted` - Convenience property, informs about a TLS error.
- `powerAuthErrorResponse` - If the error was caused by the PowerAuth error, you can retrieve it here.
- `powerAuthRestApiErrorCode` - If the error was caused by the PowerAuth error, the error code of the original error will be available here.

### WPNErrorReason

Each `WPNError` has a `reason` property for why the error was created. Such reason can be useful when you're creating for example a general error handling or reporting, or when you're debugging the code.

#### General errors  

| Option Name | Description |
|---|---|
|`unknown`|Unknown fallback reason|
|`missingActivation`|PowerAuth instance is missing an activation.|

#### Network errors

| Option Name | Description |
|---|---|
|`network_unknown`|When unknown (usually logic error) happened during networking.|
|`network_generic`|Network error that indicates a generic network issue (for example server internal error).|
|`network_errorStatusCode`|HTTP response code was different than 200 (success).|
|`network_invalidResponseObject`|An unexpected response from the server.|
|`network_invalidRequestObject`|Request is not valid. Such an object is not sent to the server.|
|`network_signError`|When the signing of the request failed.|
|`network_timeOut`|Request timed out|
|`network_noInternetConnection`|Not connected to the internet.|
|`network_badServerResponse`|Bad (malformed) HTTP server response. Probably an unexpected HTTP server error.|
|`network_sslError`|SSL error. For detailed information, see the attached error object when available.|

#### Custom Errors

`WPNErrorReason` is a struct that can be created by other libraries so the list above is not a final list of all possible errors. Such errors (in libraries developed by Wultra) will be presented in the dedicated documentation (for example Mobile Token SDK library).

## Language Configuration

Before using any methods from this SDK that call the backend, a proper language should be set. A properly translated content is served based on this configuration. The property that stores language settings __does not persist__. You need to set `acceptLanguage` every time that the application boots.

<!-- begin box warning -->
Note: Content language capabilities are limited by the implementation of the server - it must support the provided language.
<!-- end -->

### Format

The default value is always `en`. With other languages, we use values compliant with standard RFC [Accept-Language](https://tools.ietf.org/html/rfc7231#section-5.3.5).

## Logging

You can set up logging for the library using the `WPNLogger` class.

### Verbosity Level

You can limit the amount of logged information via the `verboseLevel` property.

| Level                  | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `off`                  | Silences all logs.                                |
| `errors`               | Only errors will be logged.                       |
| `warnings` _(default)_ | Errors and warnings will be logged.               |
| `info`                 | Error, warning and info messages will be logged.  |
| `debug`                | All messages will be logged.                      |

### Character limit

To prevent huge logs from being printed out, there is a default limit of 12,000 characters per log in place. You can change this via `WPNLogger.characterLimit`.

### HTTP traffic logs

- You can turn on or off logging of HTTP requests and responses with the `WPNLogger.logHttpTraffic` property.
- You can filter which headers will be logged with the `WPNLogger.httpHeadersToSkip` property.

### Logger Delegate

In case you want to process logs on your own (for example log into a file or some cloud service), you can set `WPNLogger.delegate`.

## Changelog

### 1.0.0

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
