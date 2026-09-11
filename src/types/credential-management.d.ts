// The Credential Management API's PasswordCredential isn't in TypeScript's
// lib.dom.d.ts yet (it's Chromium/Safari-shipped, not yet in the stable
// spec TS tracks) — this is the minimal surface lib/save-credential.ts
// needs. `Credential` and `CredentialsContainer.store()` themselves are
// already in lib.dom.

interface PasswordCredentialData {
  id: string;
  password: string;
  name?: string;
  iconURL?: string;
}

interface PasswordCredential extends Credential {
  readonly password: string;
}

declare const PasswordCredential: {
  prototype: PasswordCredential;
  new (data: PasswordCredentialData): PasswordCredential;
};
