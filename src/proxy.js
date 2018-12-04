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
    snapshotDir: path.join(process.cwd(), "snapshot"),
    target: "https://jsonplaceholder.typicode.com",
    disableCORS: 0,
    disableRecord: 0,
    disableReplay: 0
  }
});

function run({
  port,
  target,
  snapshotDir,
  modifier = { request: {}, response: {} },
  disableCors,
  disableRecord,
  disableReplay
}) {
  const url = URL.parse(target);
  const tapeManager = new TapeManager(path.resolve(snapshotDir), target);

  const proxy = httpProxy.createProxyServer({
    target: {
      ...url,
      pfx: fs.readFileSync(path.join(__dirname, "client.p12")),
      passphrase: "1234"
    },
    selfHandleResponse: true,
    changeOrigin: true
  });


  proxy.on("proxyReq", (proxyReq, req) => {
    // start record
    debug('request path', proxyReq.path, proxyReq.method);
    debug('request headers', proxyReq.getHeaders());

    proxyReq.removeHeader("if-none-match");
    const record = tapeManager.getNewRecord();
    req.reProxiiRecord = record;

    record.setPath(proxyReq.path);
    record.setMethod(proxyReq.method);
    record.captureHeader(proxyReq.getHeaders(), "request");

    let buffer = new Buffer("", "binary");

    req.on("data", function(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
    });
    req.on("end", () => {
      debug("request capture end");
      record.captureBody(buffer, "request");
    });
    req.on("error", () => {
      debug("request upstream error");
      record.captureBody(buffer, "request");
    });
  });

  proxy.on("proxyRes", function(proxyRes, req, res) {
    var body = new Buffer("", "binary");
    let record = req.reProxiiRecord;

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

  proxy.on("error", (err, req, res) => {
    debug("error", err);
    let log = debug.extend('replay');
    const record = req.reProxiiRecord;

    log(tapeManager.getRecordId(record), record.envelop.request.body)
    tapeManager.pickAndReplay(record).then((tape) => {
      res.writeHead(200, tape.envelop.response.headers)
      res.write(tape.envelop.response.body);
      res.end();
    }).catch(err => {
      log('no tape found', tapeManager.getRecordId(record), record.path, record.method, record.envelop.request.body);
      res.writeHead(500, {'Content-Type': 'application/json'});
      res.write('{"error": 1}');
      res.end();
    });
  });

  proxy.listen(port);
  console.info('Server started on %s for target %s', port, target);
}

run(argv);
