const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { Record } = require("./record");
const debug = require('debug')('reproxii:tape');

class TapeManager {
  constructor(snapshotFolder, host) {
    this.snapshotFolder = snapshotFolder;
    this.host = host;
  }
  getNewRecord() {
    return new Record();
  }

  getRecordId(record) {
    const hash = crypto.createHash("sha256");
    return hash
      .update(
        [
          record.path,
          record.method,
          (record.envelop.request.body||"").toString()
        ].join("")
      )
      .digest("hex");
  }

  /**
   * @param {Record} record
   */
  async persistRecord(record) {
    const id = this.getRecordId(record);
    const sRecord = await record.serialize();
    sRecord.__updatedOn = (new Date()).toISOString();

    await new Promise(resolve => {
      fs.writeFile(
        path.join(this.snapshotFolder, `${id}.json`),
        JSON.stringify(sRecord, null, 2),
        { encoding: "utf8" },
        err => {
          if(err) debug('persis error', id, sRecord);
          resolve();
        }
      );
    });
  }

  /**
   *
   * @param {Record} record
   */
  pickAndReplay(record) {
    const id = this.getRecordId(record);
    debug('record id', id);
    return new Promise((resolve, reject) => {
      fs.readFile(
        path.join(this.snapshotFolder, `${id}.json`),
        { encoding: "utf8" },
        (err, data) => {
          if (err) return reject(err);
          return resolve(data);
        }
      );
    }).then(data => {
      const rawRecord = JSON.parse(data);
      let tape = this.getNewRecord();
      const body =
        typeof rawRecord.response.body === "string"
          ? new Buffer(rawRecord.response.body + "", "base64")
          : new Buffer(JSON.stringify(rawRecord.response.body), 'utf8');
      tape.captureBody(body, "response");
      delete rawRecord.response.headers["content-length"];
      tape.captureHeader(rawRecord.response.headers, "response");
      return tape;
    });
  }
}

module.exports.TapeManager = TapeManager;
