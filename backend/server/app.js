const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const apiRoutes = require("./routes");

const { AppError, isAppError } = require("./lib/errors");
const { sendError } = require("./lib/response");

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Library API is running" });
});

app.use("/api", apiRoutes);

app.use((req, res) => {
  sendError(res, new AppError(404, "Resource not found"));
});

app.use((err, req, res, next) => {
  if (isAppError(err)) {
    return sendError(res, err);
  }

  console.error(err);
  return sendError(res, new AppError(500, "Internal server error"));
});

module.exports = app;
