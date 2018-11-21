const zlib = require("zlib");
const brDecompress = require("iltorb").decompress;

class Record {
  constructor() {
    this.path = "";
    this.method = "";
    this.envelop = {
      request: { headers: {}, body: null },
      response: { headers: {}, body: null }
    };
  }

  setPath(path) {
    this.path = path;
  }

  setMethod(method) {
    this.method = method;
  }

  captureHeader(headers, part = "request") {
    Object.keys(headers).forEach(h => {
      this.envelop[part].headers[h] = headers[h];
    });
  }

  captureBody(body, part = "request") {
    this.envelop[part].body = body;
  }

  async serialize() {
    const request = { headers: this.envelop.request.headers };
    const response = { headers: this.envelop.response.headers };

    // serialize request
    if (
      request.headers["content-type"] &&
      request.headers["content-type"].indexOf("application/json") > -1
    ) {
      request.body = JSON.parse(this.envelop.request.body.toString("utf8"));
    } else {
      request.body = this.envelop.request.body.toString("base64");
    }

    // serialize response
    if (
      response.headers["content-type"] &&
      response.headers["content-type"].indexOf("application/json") > -1
    ) {
      let body = await this.processResponseBody(
        this.envelop.response.body,
        response.headers["content-encoding"]
      );
      delete response.headers["content-encoding"];
      response.body = JSON.parse(body);
    } else {
      response.body = this.envelop.response.body.toString("base64");
    }

    return { path: this.path, method: this.method, request, response };
  }

  /**
   *
   * @param {Buffer} body
   * @param {string} encoding
   */
  processResponseBody(body, encoding) {
    switch (encoding) {
      case "gzip":
        return new Promise((resolve, reject) =>
          zlib.unzip(body, (err, result) => {
            if (err) return reject(err);
            return resolve(result);
          })
        );
      case "br":
        return brDecompress(body);
      default:
        return Promise.resolve(body);
    }
  }
}

module.exports.Record = Record;
