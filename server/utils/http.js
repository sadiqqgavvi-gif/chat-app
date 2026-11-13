const mongoose = require("mongoose");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const fail = (status, message) => {
  throw new HttpError(status, message);
};

const isId = (value) =>
  typeof value === "string" && mongoose.isValidObjectId(value);

// Throws a 400 unless `value` is a well-formed ObjectId string.
const requireId = (value, label = "id") => {
  if (!isId(value)) fail(400, `A valid ${label} is required`);
  return value;
};

const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);

const escapeRegex = (text) =>
  String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { HttpError, fail, isId, requireId, sameId, escapeRegex };
