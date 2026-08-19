"use strict";

const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const dayjs = require("dayjs");
const config = require("../config.js");
const convertToBytes = require("../helpers/convertToBytes");

const maxSize = convertToBytes(config.max_post_size);
const DIR = "./storage/design_templates/";

function makeid(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function htmlOnly(originalname) {
  return /\.html$/i.test(path.extname(originalname).toLowerCase());
}

async function designTemplateUploadPreHandler(request, reply) {
  const body = {};
  let uploadedFile = null;

  const parts = request.parts({ limits: { fileSize: maxSize } });
  for await (const part of parts) {
    if (part.file) {
      if (part.fieldname === "file") {
        if (!htmlOnly(part.filename)) {
          return reply
            .status(400)
            .send({ error: "File upload only supports .html files" });
        }
        await fs.promises.mkdir(DIR, { recursive: true });
        const safeName =
          dayjs().format("yyyymmdd-hhmmss") +
          "_" +
          makeid(16) +
          "_" +
          part.filename.toLowerCase().split(" ").join("-");
        const filepath = path.join(DIR, safeName);
        await pipeline(part.file, fs.createWriteStream(filepath));
        uploadedFile = {
          path: filepath,
          filename: path.basename(filepath),
          originalname: part.filename,
          mimetype: part.mimetype,
          fieldname: part.fieldname,
        };
      } else {
        await part.file.resume();
      }
    } else if (part.fieldname) {
      body[part.fieldname] = part.value;
    }
  }

  if (!uploadedFile) {
    return reply.status(400).send({ error: "File is not valid" });
  }

  request.compatBody = { ...request.body, ...body };
  request.compatFile = uploadedFile;
}

module.exports = { designTemplateUploadPreHandler };
