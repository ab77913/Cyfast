"use strict";

const helpers = require("../helpers");
const path = require("path");
const config = require("../config.js");
const executionLogFactory = require("../database/" + config.db_type_secondary + "/factories/executionLogFactory");
const archiver = require("archiver");
const fs = require("fs");
const dayjs = require("dayjs");
const { exit } = require("process");
const util = require("util");
const { dir } = require("console");
const exec = util.promisify(require("child_process").exec);

const createLog = async (req, res) => {
  try {
    const data = req.body;

    const log = await executionLogFactory.createLog(data);

    res.send(log);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const uploadLog = async (req, res, next) => {
  try {
    if (req.file == undefined) {
      return res.status(400).send({
        message: "Error occured while uploading file, Please upload a file!",
      });
    }
    console.log(
      "Received log upload request for Execution Id - ",
      req.body.orchestration_execution_id,
      ", File name - ",
      req.file.originalname
    );
    const projectId = req.body.project_id;
    const orchestrationId = req.body.orchestration_id;
    const orchestrationExecutionId = req.body.orchestration_execution_id;

    let agent = { agent_id: req.body.agent_id, agent_name: req.body.agent_name };
    const format = req.body.format;
    const fileName = req.file.originalname;
    const filePath = req.file.path;
    const uploadDirPath = config.storage_dir_path + path.sep + req.body.orchestration_execution_id;
    if (!fs.existsSync(uploadDirPath)) {
      fs.mkdirSync(uploadDirPath, { recursive: true, mode: 0o755 });
    }
    const uploadFilePath = uploadDirPath + path.sep + fileName;

    fs.rename(filePath, uploadFilePath, async function (err) {
      if (err) throw err;
      const data = {
        project_id: projectId,
        orchestration_id: orchestrationId,
        orchestration_execution_id: orchestrationExecutionId,
        agent: agent,
        file_name: fileName,
        mime_type: req.file.mimetype,
        file_extension: path.extname(fileName),
        format: format,
        source_file_path: uploadFilePath,
      };

      let log = await executionLogFactory.createLog(data);
    });

    res.send(true);
  } catch (err) {
    //Delete file in case of any error.
    fs.unlinkSync(req.file.path);

    res.status(500).send({
      message: "Could not import file: " + req.file.originalname + ", Error - " + err,
    });
  }
};

// const generateReport = async (req, res, next) => {
//   const { projectId, orchestrationId, orchestrationExecutionId } = req.query;
//   let dirPath = config.app_path + path.sep + "storage" + path.sep + "execution_logs" + path.sep + orchestrationExecutionId;
//   let reportPath = dirPath + "/merged_log.html";

//   try {
//     const logs = await executionLogFactory.getByFilter({ orchestration_execution_id: orchestrationExecutionId });
//     if (logs.pagination.totalItems > 0) {
//       if (!fs.existsSync(dirPath)) {
//         fs.mkdirSync(dirPath);
//       }
//       //TODO - Use plugin approach to merge reports and show

//       let logFiles = "";
//       for (let log of logs.data) {
//         logFiles += log.file_name + " ";
//         let logContentPath = dirPath + path.sep + log.file_name;
//         fs.writeFileSync(logContentPath, log.log_content);
//       }

//       let commandExecute =
//         "rebot --name TopSuite --log merged_log --report merged_report --outputdir " + dirPath + "  " + dirPath + path.sep + "*.xml";

//       if (logs.data[0].fileName.endsWith(".html")) {
//         commandExecute = "pytest_html_merger -i " + dirPath + " -o " + reportPath;
//       }

//       await exec(commandExecute);
//       console.log(commandExecute);

//       let reportContent = fs.readFileSync(reportPath, "utf8");
//       res.send(reportContent);
//     } else {
//       res.status(400).send("No logs found for this execution");
//     }
//   } catch (error) {
//     if (!fs.existsSync(reportPath)) {
//       res.status(500).send(error.message);
//     } else {
//       let reportContent = fs.readFileSync(reportPath, "utf8");
//       res.send(reportContent);
//     }
//   } finally {
//     if (fs.existsSync(reportPath)) {
//       fs.unlinkSync(reportPath);
//     }
//     //Send HTML report
//   }
// };

const getLogs = async (req, res, next) => {
  try {
    const { page, size, filters, sort } = req.query;

    const logs = await executionLogFactory.getByFilter(filters, sort, page, size);

    res.send(logs);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getOrchestrationExecutionLogs = async (req, res, next) => {
  try {
    const orchestrationExecutionId = req.params.execution_id;
    console.log(orchestrationExecutionId);
    const logs = await executionLogFactory.getByExecutionId(orchestrationExecutionId);

    res.send(logs);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const getLog = async (req, res, next) => {
  //Download content to xml files and rebot to html
  try {
    const id = req.params.id;

    const log = await consoleLogFactory.getLogById(id);

    res.send(log);
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const getOrchestrationExecutionReport = async (req, res, next) => {
  //Download content to xml files and rebot to html
  try {
    let filters = {};
    filters["orchestration_execution_id"] = req.params.execution_id;
    filters["file_name"] = req.params.report_file;

    const logs = await executionLogFactory.getByFilter(filters);
    const log = logs.data.length > 0 ? logs.data[0] : null;

    if (fs.existsSync(log.source_file_path)) {
      let mimeType = "text/html";
      if (log.file_extension == ".jpg" || log.file_extension == ".jpeg" || log.file_extension == ".png") {
        mimeType = "image/" + log.file_extension.replace(".", "");
      }
      const file = fs.readFile(log.source_file_path, (err, file) => {
        if (err) res.status(404).end("Report Not Found");
        res.set("Content-Type", mimeType);
        res.send(file);
      });
    } else {
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const downloadOrchestrationExecutionReports = async (req, res, next) => {
  //Download content to xml files and rebot to html
  try {
    let orchestrationExecutionId = req.params.execution_id;

    let dirPath = config.app_path + path.sep + "storage" + path.sep + "execution_logs" + path.sep + orchestrationExecutionId;
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    let zipPath = dirPath + path.sep + orchestrationExecutionId + ".zip";

    //zip all files
    const reportsDirPath = config.storage_dir_path + path.sep + orchestrationExecutionId;
    const stream = fs.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });
    return new Promise((resolve, reject) => {
      archive
        .directory(reportsDirPath, false)
        .on("error", (err) => reject(err))
        .pipe(stream);

      stream.on("close", () => {
        res.setHeader("Content-disposition", "attachment; filename=test1.zip");
        res.download(zipPath);
      });
      archive.finalize();
    });
  } catch (error) {
    res.status(400).send(error.message);
  }
};

const viewReport = async (req, res, next) => {
  try {
    let filters = {};
    let scriptFileName = req.query.test_script;
    filters["orchestration_execution_id"] = req.query.orchestration_execution_id;
    //TODO - hardcoded extension
    filters["file_name"] = scriptFileName ? scriptFileName.replace(/\.[^/.]+$/, ".html") : "";
    const logs = await executionLogFactory.getByFilter(filters);

    let reportContent = "";
    for (let log of logs.data) {
      if (log.file_name == filters["file_name"]) {
        reportContent += log.log_content;
      }
    }

    res.send(reportContent);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const downloadAllReports = async (req, res, next) => {
  try {
    let filters = {};
    filters["orchestration_execution_id"] = req.query.orchestration_execution_id;

    const logs = await executionLogFactory.getByFilter(filters);
    //console.log("Logs", logs);

    let dirPath = config.app_path + path.sep + "storage" + path.sep + "execution_logs" + path.sep + filters["orchestration_execution_id"];
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }

    for (let log of logs.data) {
      let logContentPath = dirPath + path.sep + log.file_name;
      fs.writeFileSync(logContentPath, log.log_content);
    }

    //zip all files
    let zipPath =
      config.app_path + path.sep + "storage" + path.sep + "execution_logs" + path.sep + filters["orchestration_execution_id"] + ".zip";
    const stream = fs.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });
    return new Promise((resolve, reject) => {
      archive
        .directory(dirPath, false)
        .on("error", (err) => reject(err))
        .pipe(stream);

      stream.on("close", () => {
        res.setHeader("Content-disposition", "attachment; filename=test1.zip");
        res.download(zipPath);
      });
      archive.finalize();
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  uploadLog,
  // generateReport,
  getLogs,
  getOrchestrationExecutionLogs,
  getLog,
  createLog,
  downloadOrchestrationExecutionReports,
  getOrchestrationExecutionReport,
  viewReport,
  downloadAllReports,
};
