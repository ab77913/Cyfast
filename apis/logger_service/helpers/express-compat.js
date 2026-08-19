"use strict";

const fs = require("fs");
const path = require("path");
const { finished } = require("stream/promises");

function createExpressCompat(request, reply) {
  let sent = false;

  function markSent() {
    sent = true;
  }

  const req = {
    query: request.query,
    params: request.params,
    body:
      request.compatBody !== undefined ? request.compatBody : request.body || {},
    headers: request.headers,
    file: request.compatFile !== undefined ? request.compatFile : request.file,
    files: request.files,
    get(name) {
      return request.headers[name.toLowerCase()];
    },
  };

  const res = {
    status(code) {
      reply.code(code);
      return res;
    },
    json(body) {
      if (sent) return res;
      markSent();
      return reply.type("application/json").send(body);
    },
    send(body) {
      if (sent) return res;
      markSent();
      return reply.send(body);
    },
    end(chunk) {
      if (sent) return res;
      markSent();
      return reply.send(chunk !== undefined ? chunk : "");
    },
    set(name, value) {
      reply.header(name, value);
      return res;
    },
    setHeader(name, value) {
      reply.header(name, value);
      return res;
    },
    getHeader(name) {
      return reply.getHeader(name);
    },
    type(ct) {
      reply.type(ct);
      return res;
    },
    download(filePath, filenameOrFn, maybeFn) {
      let filename = path.basename(filePath);
      let cb = () => {};

      if (typeof filenameOrFn === "function") {
        cb = filenameOrFn;
      } else if (typeof filenameOrFn === "string") {
        filename = filenameOrFn;
        if (typeof maybeFn === "function") {
          cb = maybeFn;
        }
      }

      const stream = fs.createReadStream(filePath);
      stream.on("error", (err) => {
        try {
          cb(err);
        } catch (_) {
          /* ignore */
        }
      });

      reply
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .type("application/octet-stream");

      finished(reply.raw)
        .then(() => {
          try {
            cb(null);
          } catch (_) {
            /* ignore */
          }
        })
        .catch(() => {
          try {
            cb(new Error("stream closed"));
          } catch (_) {
            /* ignore */
          }
        });

      if (!sent) {
        markSent();
        return reply.send(stream);
      }
      return res;
    },
  };

  return { req, res };
}

function wrapExpressHandler(handler) {
  return async function wrapped(request, reply) {
    const { req, res } = createExpressCompat(request, reply);
    const next = (err) => {
      if (err && !reply.sent) {
        reply.send(err);
      }
    };
    const out = handler(req, res, next);
    if (out && typeof out.then === "function") {
      await out;
    }
  };
}

module.exports = { createExpressCompat, wrapExpressHandler };
