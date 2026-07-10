// SecretReader registry. providerService.runPayment-style calls need a
// SecretReader to decrypt installation credentials before invoking the
// concrete provider bundle. The reader is a process-wide singleton set
// by the host (api-rest, workers) at boot:
//
//   import { setSecretReader } from '@sparx/commerce';
//   setSecretReader(myReader);
//
// Tests inject a mapSecretReader directly. Dev defaults to env-only
// (`env:STRIPE_SECRET_KEY` style refs), which keeps `pnpm dev` working
// without any GCP credentials.
//
// Every reader set here is wrapped with inline `enc:` decryption — a
// tenant-pasted provider secret (encrypted by provider-service.ts's
// install()/updateConfig()) never points AT a store, it CARRIES the
// ciphertext, so decrypting it needs no I/O and must work the same way
// regardless of which base reader (env, GSM, ...) is active.

import {
  decryptProviderSecret,
  isEncryptedProviderSecretRef,
  SecretNotFoundError,
  type SecretReader,
} from '@sparx/integration-framework';

export function envSecretReader(): SecretReader {
  return {
    read(ref: string): Promise<string> {
      if (!ref.startsWith('env:')) {
        throw new SecretNotFoundError(ref);
      }
      const name = ref.slice('env:'.length);
      const value = process.env[name];
      if (!value) throw new SecretNotFoundError(ref);
      return Promise.resolve(value);
    },
  };
}

export function mapSecretReader(entries: Record<string, string>): SecretReader {
  return {
    read(ref: string): Promise<string> {
      if (ref in entries) return Promise.resolve(entries[ref]!);
      return Promise.reject(new SecretNotFoundError(ref));
    },
  };
}

function withInlineDecryption(base: SecretReader): SecretReader {
  return {
    read(ref: string): Promise<string> {
      if (isEncryptedProviderSecretRef(ref)) return Promise.resolve(decryptProviderSecret(ref));
      return base.read(ref);
    },
  };
}

let activeReader: SecretReader = withInlineDecryption(envSecretReader());

export function setSecretReader(reader: SecretReader): void {
  activeReader = withInlineDecryption(reader);
}

export function getSecretReader(): SecretReader {
  return activeReader;
}
