const fs = require('fs');
const path = require('path');

console.log('Applying self-signed SSL certificate patch to Capacitor iOS and Android...');

// 1. Patch iOS CapacitorUrlRequest.swift
const iosFilePath = path.join(__dirname, '..', 'node_modules', '@capacitor', 'ios', 'Capacitor', 'Capacitor', 'Plugins', 'CapacitorUrlRequest.swift');
if (fs.existsSync(iosFilePath)) {
  let content = fs.readFileSync(iosFilePath, 'utf8');

  const fullSslDelegateMethods = `    open func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let serverTrust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
            return
        }
        completionHandler(.performDefaultHandling, nil)
    }

    open func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let serverTrust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
            return
        }
        completionHandler(.performDefaultHandling, nil)
    }

    open func getUrlSession(_ call: CAPPluginCall) -> URLSession {
        return URLSession(configuration: URLSessionConfiguration.default, delegate: self, delegateQueue: nil)
    }`;

  // Check if already patched with full handlers
  if (content.includes('task: URLSessionTask, didReceive challenge')) {
    console.log('✓ CapacitorUrlRequest.swift already fully patched.');
  } else if (content.includes('open func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge')) {
    // Replace partial patch with full patch
    const partialMatch = /open func urlSession\(_ session: URLSession, didReceive challenge:[\s\S]*?open func getUrlSession\(_ call: CAPPluginCall\) -> URLSession \{[\s\S]*?\}/;
    content = content.replace(partialMatch, fullSslDelegateMethods.trim());
    fs.writeFileSync(iosFilePath, content, 'utf8');
    console.log('✓ Upgraded CapacitorUrlRequest.swift to full SSL challenge handlers.');
  } else {
    // Standard patch replacing original getUrlSession
    const oldGetUrlSession = `    open func getUrlSession(_ call: CAPPluginCall) -> URLSession {
        let disableRedirects = call.getBool("disableRedirects") ?? false
        if !disableRedirects {
            return URLSession.shared
        }
        return URLSession(configuration: URLSessionConfiguration.default, delegate: self, delegateQueue: nil)
    }`;

    if (content.includes(oldGetUrlSession)) {
      content = content.replace(oldGetUrlSession, fullSslDelegateMethods);
      fs.writeFileSync(iosFilePath, content, 'utf8');
      console.log('✓ Successfully patched CapacitorUrlRequest.swift for iOS self-signed SSL trust.');
    } else {
      // Fallback replacement
      content = content.replace(/open func getUrlSession\(_ call: CAPPluginCall\) -> URLSession \{[\s\S]*?\}/, fullSslDelegateMethods.trim());
      fs.writeFileSync(iosFilePath, content, 'utf8');
      console.log('✓ Applied regex replacement to CapacitorUrlRequest.swift');
    }
  }
} else {
  console.log('ℹ iOS CapacitorUrlRequest.swift not found (skipping or not installed yet).');
}

// 2. Patch Android HttpRequestHandler.java
const androidFilePath = path.join(__dirname, '..', 'node_modules', '@capacitor', 'android', 'capacitor', 'src', 'main', 'java', 'com', 'getcapacitor', 'plugin', 'util', 'HttpRequestHandler.java');
if (fs.existsSync(androidFilePath)) {
  let content = fs.readFileSync(androidFilePath, 'utf8');

  const targetLine = 'connection = new CapacitorHttpUrlConnection((HttpURLConnection) url.openConnection());';
  const sslPatch = `            HttpURLConnection rawConn = (HttpURLConnection) url.openConnection();
            if (rawConn instanceof javax.net.ssl.HttpsURLConnection) {
                try {
                    javax.net.ssl.TrustManager[] trustAllCerts = new javax.net.ssl.TrustManager[]{
                        new javax.net.ssl.X509TrustManager() {
                            public java.security.cert.X509Certificate[] getAcceptedIssuers() { return null; }
                            public void checkClientTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                            public void checkServerTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                        }
                    };
                    javax.net.ssl.SSLContext sc = javax.net.ssl.SSLContext.getInstance("SSL");
                    sc.init(null, trustAllCerts, new java.security.SecureRandom());
                    ((javax.net.ssl.HttpsURLConnection) rawConn).setSSLSocketFactory(sc.getSocketFactory());
                    ((javax.net.ssl.HttpsURLConnection) rawConn).setHostnameVerifier((hostname, session) -> true);
                } catch (Exception ignored) {}
            }
            connection = new CapacitorHttpUrlConnection(rawConn);`;

  if (content.includes(targetLine)) {
    content = content.replace(targetLine, sslPatch);
    fs.writeFileSync(androidFilePath, content, 'utf8');
    console.log('✓ Successfully patched HttpRequestHandler.java for Android self-signed SSL trust.');
  } else if (content.includes('trustAllCerts')) {
    console.log('✓ HttpRequestHandler.java already patched.');
  }
} else {
  console.log('ℹ Android HttpRequestHandler.java not found (skipping or not installed yet).');
}

// 3. Patch iOS Info.plist if present
const infoPlistPath = path.join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist');
if (fs.existsSync(infoPlistPath)) {
  let plist = fs.readFileSync(infoPlistPath, 'utf8');
  if (!plist.includes('NSAppTransportSecurity')) {
    const atsBlock = `\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<true/>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>\n\t</dict>\n`;
    plist = plist.replace('<dict>', '<dict>\n' + atsBlock);
    fs.writeFileSync(infoPlistPath, plist, 'utf8');
    console.log('✓ Added NSAppTransportSecurity to Info.plist.');
  } else {
    console.log('✓ Info.plist already has NSAppTransportSecurity.');
  }
}

console.log('SSL patch verification complete.');
