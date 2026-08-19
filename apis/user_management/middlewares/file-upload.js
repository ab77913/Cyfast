const path = require("path");
const fs = require("fs");
const config = require("../config.js");
const { convertToBytes } = require("../helpers");
const dayjs = require("dayjs");

const maxSize = convertToBytes(config.max_post_size);

function makeid(length) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const DIR = "./storage/design_templates/";

/**
 * Fastify preHandler hook for single-file uploads via @fastify/multipart.
 * Saves the uploaded file to disk and attaches metadata to `request.uploadedFile`.
 * Register @fastify/multipart on the Fastify instance before using this hook.
 */
module.exports.send = async (request, reply) => {
  try {
    const data = await request.file();

    if (!data) {
      return reply.send({ error: "File is not valid" });
    }

    const ext = path.extname(data.filename).toLowerCase();
    if (!/\.html$/.test(ext)) {
      return reply.code(400).send({
        error: "Error: File upload only supports the following filetypes - html",
      });
    }

    const fileName = data.filename.toLowerCase().split(" ").join("-");
    const savedName =
      dayjs().format("YYYYMMDD-HHmmss") + "_" + makeid(16) + "_" + fileName;
    const savePath = path.join(DIR, savedName);

    if (!fs.existsSync(DIR)) {
      fs.mkdirSync(DIR, { recursive: true });
    }

    const writeStream = fs.createWriteStream(savePath);
    let size = 0;

    for await (const chunk of data.file) {
      size += chunk.length;
      if (size > maxSize) {
        writeStream.destroy();
        fs.unlinkSync(savePath);
        return reply.code(413).send({ error: "File too large" });
      }
      writeStream.write(chunk);
    }
    writeStream.end();

    request.uploadedFile = {
      filename: savedName,
      originalname: data.filename,
      path: savePath,
      size,
    };
  } catch (err) {
    return reply.code(500).send({ error: "File upload failed" });
  }
};
