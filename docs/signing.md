# Code-signing certificates and secrets

How to obtain, install, and renew the credentials used to sign and notarize
Doru releases. Certificates expire, so keep this guide close — you will need
it again.

All credentials live in GitHub repository secrets:
**Settings → Secrets and variables → Actions → New repository secret**.

## macOS

Two independent pieces: a **Developer ID Application certificate** (for
signing) and an **App Store Connect API key** (for notarization).

### 1. Developer ID Application certificate

Used by secrets `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD`.

1. Open **Xcode → Settings → Accounts**, select your Apple ID, click
   **Manage Certificates**, then **+ → Developer ID Application**.
   Alternatively: generate a certificate signing request in Keychain Access
   (Certificate Assistant → Request a Certificate From a Certificate
   Authority), upload it on
   [developer.apple.com](https://developer.apple.com) under
   **Certificates, IDs & Profiles → Certificates → + → Developer ID
   Application**, download the `.cer`, and double-click it to install it into
   your Keychain.
2. Open **Keychain Access → My Certificates**, find the
   `Developer ID Application: …` entry, right-click → **Export "Developer ID
   Application…"** → file format **.p12** → set a password.
3. Encode and store:
   - `MAC_CSC_LINK` = `base64 -i certificate.p12` (single line)
   - `MAC_CSC_KEY_PASSWORD` = the password you set for the `.p12`

Expiry: check the certificate's validity in
[Certificates, IDs & Profiles](https://developer.apple.com/account/resources/certificates/list).
When it expires, create a new one and update both secrets.

### 2. App Store Connect API key (notarization)

Used by secrets `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.

1. Go to [App Store Connect](https://appstoreconnect.apple.com) →
   **Users and Access → Integrations → API Keys** (Team Keys tab).
2. Click **+**, name it (e.g. `doru-notarize`), choose the **Developer** role
   (App Manager also works), and generate.
3. Download the `AuthKey_XXXXXXXX.p8` file — **it can only be downloaded once,
   at creation time**. Store it safely (password manager).
4. On the same page you will find the **Issuer ID** (a UUID). The **Key ID**
   is the `XXXXXXXX` part of the file name.
5. Encode and store:
   - `APPLE_API_KEY` = `base64 -i AuthKey_XXXXXXXX.p8`
   - `APPLE_API_KEY_ID` = the Key ID
   - `APPLE_API_ISSUER` = the Issuer ID

Expiry: API keys have no built-in expiration date, but they can be revoked in
App Store Connect at any time. If notarization starts failing with an
authentication error, check whether the key still exists in **Users and
Access → Integrations**; if not, create a new one and update all three
secrets.

## Windows (not enabled yet)

Windows code signing is not part of the release pipeline yet. When it is
enabled, it will use secrets `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`:

1. Buy an **OV code-signing certificate** from a CA (SSL.com, Certum,
   Sectigo/DigiCert). Organization validation typically involves a phone call
   or D-U-N-S lookup and takes a few days.
2. Download/export the certificate as **.pfx** with a password.
3. Encode and store:
   - `WIN_CSC_LINK` = `base64 -i certificate.pfx`
   - `WIN_CSC_KEY_PASSWORD` = the password

Expiry: OV certificates are typically valid for one year. Renew before expiry
and update both secrets; the release workflow picks them up automatically.

## Verifying a signed build locally

On macOS:

```sh
codesign -dv --verbose=4 "Doru.app"            # shows the signing identity
spctl -a -vvv -t install "Doru.app"            # "accepted" means notarized
```

## Notes

- Secrets are not passed to workflows triggered from forks (pull requests), so
  they are safe to keep in the repository.
- Store the `.p12`/`.p8`/`.pfx` files and their passwords somewhere durable
  outside the repository; the secrets themselves are never readable again
  after being saved to GitHub.
