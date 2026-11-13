const notFound = (req, res) => {
  res.status(404).json({ message: "Not found" });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.name === "CastError" || err.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid request data" });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File is too large (max 25 MB)" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large" });
  }

  console.error(err);
  res.status(500).json({ message: "Server error" });
};

module.exports = { notFound, errorHandler };
