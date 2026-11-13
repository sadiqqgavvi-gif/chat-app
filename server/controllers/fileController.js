const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const { fail, isId } = require("../utils/http");

const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Types a browser may render in place. Everything else (HTML, SVG, ...)
// is always sent as a download so uploads can never run as a page.
const INLINE_TYPES =
  /^(image\/(png|jpeg|gif|webp|avif|bmp)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/pdf)$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
}).single("file");

const bucket = () =>
  new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });

// Files live in MongoDB (GridFS), so they survive redeploys on hosts
// with an ephemeral disk and need no extra storage service.
const uploadFile = async (req, res) => {
  if (!req.file) fail(400, "No file was uploaded");

  // Multer decodes multipart filenames as latin1; restore UTF-8 names.
  const name = Buffer.from(req.file.originalname, "latin1")
    .toString("utf8")
    .slice(0, 200);
  // Drop parameters such as ";codecs=opus" that recorders append.
  const mimeType =
    (req.file.mimetype || "").split(";")[0].trim().toLowerCase() ||
    "application/octet-stream";
  const key = crypto.randomBytes(16).toString("hex");

  const stream = bucket().openUploadStream(name, {
    metadata: { key, mimeType, owner: req.user._id },
  });

  await new Promise((resolve, reject) => {
    stream.once("finish", resolve);
    stream.once("error", reject);
    stream.end(req.file.buffer);
  });

  res.status(201).json({
    url: `/api/files/${stream.id}/${key}`,
    name,
    mimeType,
    size: req.file.size,
  });
};

// The random key in the URL is the access check: <img>, <audio> and
// <video> tags cannot send an Authorization header.
const getFile = async (req, res) => {
  const { id, key } = req.params;
  if (!isId(id)) fail(404, "File not found");

  const [file] = await bucket()
    .find({ _id: new mongoose.Types.ObjectId(id) })
    .toArray();
  if (!file || file.metadata?.key !== key) fail(404, "File not found");

  const mimeType = file.metadata.mimeType || "application/octet-stream";
  const inline = INLINE_TYPES.test(mimeType) && !req.query.download;
  const size = file.length;

  res.set({
    "Content-Type": inline ? mimeType : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    "Cache-Control": "private, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
  });

  // Range support lets audio and video seek without downloading it all.
  let start = 0;
  let end = size - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");

  if (range && size > 0 && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), size - 1);
    } else {
      start = Math.max(size - Number(range[2]), 0);
    }

    if (start > end || start >= size) {
      return res.status(416).set("Content-Range", `bytes */${size}`).end();
    }
    res.status(206).set("Content-Range", `bytes ${start}-${end}/${size}`);
  }

  res.set("Content-Length", String(size === 0 ? 0 : end - start + 1));
  if (size === 0) return res.end();

  bucket()
    .openDownloadStream(file._id, { start, end: end + 1 })
    .on("error", () => res.destroy())
    .pipe(res);
};

module.exports = { upload, uploadFile, getFile };
