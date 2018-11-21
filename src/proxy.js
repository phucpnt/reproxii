#! /usr/bin/env node

const https = require("https");
const httpProxy = require("http-proxy");
const fs = require("fs");
const path = require("path");
const URL = require("url");
const debug = require("debug")("reproxii");

const { TapeManager } = require("./tape-manager");

const argv = require("minimist")(process.argv.slice(2), {
  default: {
    port: 8000,
    snapshortDir: path.join(process.cwd(), "snapshot"),
    target: "https://jsonplaceholder.typicode.com",
    disableCORS: 0,
    disableRecord: 0,
    disableReplay: 0
  }
});

function run({
  port,
  target,
  snapshortDir,
  modifier = { request: {}, response: {} },
  disableCors,
  disableRecord,
  disableReplay
}) {
  const url = URL.parse(target);
  const tapeManager = new TapeManager(snapshortDir, target);
  let record = null;

  const proxy = httpProxy.createProxyServer({
    agent: https.globalAgent,
    target: {
      ...url,
      pfx: fs.readFileSync(path.join(__dirname, "client.p12")),
      passphrase: "1234"
    },
    selfHandleResponse: true,
    changeOrigin: true
  });

  proxy.on("error", (err, req, res) => {
    debug('replay for request', record.path, record.method);
    tapeManager.pickAndReplay(record).then((tape) => {
      res.writeHead(200, tape.envelop.response.headers)
      res.write(tape.envelop.response.body);
      res.end();
    });
  });

  proxy.on("proxyReq", (proxyReq, req) => {
    // start record
    debug('request path', proxyReq.path, proxyReq.method);
    debug('request headers', proxyReq.getHeaders());

    record = tapeManager.getNewRecord();
    record.setPath(proxyReq.path);
    record.setMethod(proxyReq.method);
    record.captureHeader(proxyReq.getHeaders(), "request");

    let buffer = new Buffer("", "binary");

    req.on("data", function(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
    });
    req.on("end", () => {
      record.captureBody(buffer, "request");
    });
  });

  proxy.on("proxyRes", function(proxyRes, req, res) {
    var body = new Buffer("", "binary");
    proxyRes.on("data", function(data) {
      body = Buffer.concat([body, data]);
    });
    proxyRes.on("end", function() {
      debug('response headers', proxyRes.headers);
      record.captureHeader(proxyRes.headers, "response");
      record.captureBody(body, "response");
      tapeManager.persistRecord(record);

      Object.keys(proxyRes.headers).map(key => {
        res.setHeader(key, proxyRes.headers[key]);
      });
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(body, "binary");
    });
  });

  proxy.listen(port);
  console.info('Server started on %s for target %s', port, target);
}

run(argv);
