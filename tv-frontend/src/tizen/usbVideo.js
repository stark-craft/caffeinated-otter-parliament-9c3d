// src/tizen/usbVideo.js
//
// PRIMARY VIDEO:
//   USB ROOT/tv-content.mp4
//
// FALLBACK:
//   /video/tv-content.mp4

export const TV_VIDEO_FILENAME = "tv-content.mp4";
export const PACKAGED_VIDEO_SRC =
  import.meta.env.VITE_TV_VIDEO_SRC || "/video/tv-content.mp4";

function filesystemApi() {
  if (typeof globalThis === "undefined") {
    return null;
  }
  return globalThis.tizen?.filesystem || null;
}

function listStorages(fs) {
  return new Promise((resolve, reject) => {
    fs.listStorages(resolve, reject);
  });
}

function resolveStorageRoot(fs, label) {
  return new Promise((resolve, reject) => {
    fs.resolve(label, resolve, reject, "r");
  });
}

function listFiles(directory) {
  return new Promise((resolve, reject) => {
    directory.listFiles(resolve, reject);
  });
}

function isMountedRemovableStorage(storage) {
  if (!storage) {
    return false;
  }
  const label = String(storage.label || "");
  const state = String(storage.state || "").toUpperCase();
  const type = String(storage.type || "").toUpperCase();
  return (
    state === "MOUNTED" &&
    (label.startsWith("removable_") || type === "EXTERNAL")
  );
}

/**
 * Searches ONLY the root of each mounted USB/removable drive.
 *
 * Expected file:
 *
 *   USB ROOT/tv-content.mp4
 *
 * Returns a file:// URI or null.
 */
export async function findUsbVideoUri(filename = TV_VIDEO_FILENAME) {
  const fs = filesystemApi();

  // Desktop browser / Vite dev:
  // Tizen filesystem does not exist.
  if (!fs) {
    return null;
  }

  try {
    const storages = await listStorages(fs);
    const removable = (storages || []).filter(isMountedRemovableStorage);

    for (const storage of removable) {
      try {
        const root = await resolveStorageRoot(fs, storage.label);
        const files = await listFiles(root);
        const videoFile = (files || []).find(
          (file) => !file?.isDirectory && String(file?.name || "") === filename,
        );

        if (!videoFile) {
          continue;
        }

        if (typeof videoFile.toURI === "function") {
          return videoFile.toURI();
        }
        if (videoFile.fullPath) {
          return `file://${videoFile.fullPath}`;
        }
      } catch (error) {
        console.warn(`[TV video] Could not inspect ${storage.label}:`, error);
      }
    }
  } catch (error) {
    console.warn("[TV video] USB lookup failed:", error);
  }

  return null;
}

export async function resolvePreferredVideoSource() {
  const usbSrc = await findUsbVideoUri();
  if (usbSrc) {
    return {
      src: usbSrc,
      kind: "usb",
    };
  }

  return {
    src: PACKAGED_VIDEO_SRC,
    kind: "fallback",
  };
}
