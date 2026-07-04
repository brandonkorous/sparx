// @sparx/media — media asset service + focused storage for headless callers.
// The MCP tools live under the `./mcp` subpath (import from '@sparx/media/mcp')
// so a caller that only needs the service/storage doesn't pull the tool layer.

export {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_IMAGE_BYTES,
  MediaValidationError,
  createImageAssetFromBytes,
  createImageAssetFromUrl,
  resolveMediaUrl,
  type MediaWriteContext,
  type CreatedImage,
  type UploadImageBytesInput,
  type ImageFromUrlInput,
} from './asset-service.js';
export { getStorage, originalKey, safeFilename, type MediaStorage } from './storage.js';
export { storageEnv, type StorageEnv } from './env.js';
