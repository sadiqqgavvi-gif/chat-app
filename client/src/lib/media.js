export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const drawScaled = (image, maxSide, square = false) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (square) {
    // Centre-crop to a square, for avatars.
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    canvas.width = canvas.height = Math.min(maxSide, side);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return canvas;
  }

  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

// Small square JPEG data URL, stored directly on the user/group.
export const fileToAvatar = async (file) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return drawScaled(image, 256, true).toDataURL("image/jpeg", 0.85);
  } catch {
    throw new Error("Could not read that image.");
  } finally {
    URL.revokeObjectURL(url);
  }
};

const RESIZABLE = ["image/jpeg", "image/png", "image/webp"];

// Photos straight from a phone camera are huge. Shrink them before
// upload and record their dimensions so the bubble can reserve space.
const prepareImage = async (file, previewUrl) => {
  const image = await loadImage(previewUrl);
  const meta = { width: image.naturalWidth, height: image.naturalHeight };

  const big = Math.max(meta.width, meta.height) > 1920 || file.size > 600_000;
  if (!RESIZABLE.includes(file.type) || !big) return { blob: file, ...meta };

  const canvas = drawScaled(image, 1920);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob || blob.size >= file.size) return { blob: file, ...meta };

  return { blob, width: canvas.width, height: canvas.height, mimeType: "image/jpeg" };
};

const videoMeta = (url) =>
  new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    video.onerror = () => resolve({});
    video.src = url;
  });

// Turns a picked File into a draft attachment with a local preview URL.
// The upload itself happens when the message is sent.
export const prepareAttachment = async (file) => {
  const previewUrl = URL.createObjectURL(file);
  const base = {
    blob: file,
    name: file.name || "file",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    previewUrl,
  };

  try {
    if (base.mimeType.startsWith("image/")) {
      const prepared = await prepareImage(file, previewUrl);
      return { ...base, ...prepared, size: prepared.blob.size };
    }
    if (base.mimeType.startsWith("video/")) {
      return { ...base, ...(await videoMeta(previewUrl)) };
    }
  } catch {
    // Not decodable in this browser - send it as it is.
  }
  return base;
};

export const pickRecorderMimeType = () =>
  ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
    window.MediaRecorder?.isTypeSupported?.(type),
  ) || "";
