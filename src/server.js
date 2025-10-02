const express = require("express");
const bodyParser = require("body-parser");
const { readdirSync, readFileSync, lstatSync, writeFileSync } = require("fs");
const path = require("path");
const { exec, execSync } = require("child_process");
const cors = require("cors");
const { searchInFiles, searchFolderAndFiles } = require("./search");
const parseInput = require("./parseInput");


const dataFolder = path.join(__dirname, "../data");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const lastChecked = {};

function safeSuffix(unsafeSuffix) {
  return path.normalize(unsafeSuffix).replace(/^(\.\.(\/|\\|$))+/, '');
}

function isDirectory(source) {
  try {
    return lstatSync(source).isDirectory();
  } catch (e) {
    return false;
  }
}

const getDirectories = (source) =>
  readdirSync(source).filter((name) => isDirectory(path.join(source, name)));

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));
app.use(cors());

app.get("/results/:name/*", (req, res, next) => {
  const options = {
    root: path.join(dataFolder, safeSuffix(req.params.name), "/test-report/"),
    dotfiles: "deny",
  };
  const fileName = req.params[0] || "report.html";
  res.sendFile(fileName, options, (err) => {
    if (err) {
      next(err);
    } else {
      console.log("Sent:", fileName);
    }
  });
});

app.get("/api/results", (req, res) => {
  res.json(getDirectories(dataFolder));
});

function downloadAndTestJs(name, callback) {
  exec(
    `cd data && \
rm -rf ${name} && \
mkdir ${name} && \
cd ${name} && \
curl -SsL -H "Accept: application/vnd.github+json" -H 'Authorization: Bearer ${GITHUB_TOKEN}' -H 'Cache-Control: no-cache' https://api.github.com/repos/heg-web/${name}/tarball | tar xz --strip-components=1 && \
rm -rf test && \
cp -r ../../testsrc/algo-js/test test && \
npm install -s && \
mocha -R /usr/lib/node_modules/mochawesome --reporter-options reportDir=test-report,reportFilename=report`,
    (err, stdout, stderr) => {
      console.log(err, stderr);
      if (callback) callback();
    }
  );
}

function downloadAndTestPy(name, callback) {
  exec(
    `cd data && \
rm -rf ${name} && \
mkdir ${name} && \
cd ${name} && \
curl -SsL -H "Accept: application/vnd.github+json" -H 'Authorization: Bearer ${GITHUB_TOKEN}' -H 'Cache-Control: no-cache' https://api.github.com/repos/heg-web/${name}/tarball | tar xz --strip-components=1 && \
rm -rf src/algopy/test && \
cp -r ../../testsrc/algo-py/src/algopy/test src/algopy/test && \
pytest --html=test-report/report.html --self-contained-html --json-report --json-report-summary --json-report-file=test-report/report.json`,
    (err, stdout, stderr) => {
      console.log(err, stderr);
      if (callback) callback();
    }
  );
}

function downloadAndBuildJava(name, callback) {
  exec(
    `cd data && \
rm -rf ${name} && \
mkdir ${name} && \
cd ${name} && \
curl -SsL -H "Accept: application/vnd.github+json" -H 'Authorization: Bearer ${GITHUB_TOKEN}' -H 'Cache-Control: no-cache' https://api.github.com/repos/heg-web/${name}/tarball | tar xz --strip-components=1 && \
mkdir test-report && \
cd src && \
javac GuessingGame.java`,
    (err, stdout, stderr) => {
      let total = 1
      let out = ""
      if (stderr) {
        const regex = /^(\d+) errors/gm;
        const match = regex.exec(out);
        total = match ? parseInt(match[1]) : 2;
        writeFileSync(
          path.join(dataFolder, name, "test-report", "report.html"),
            `<pre>${stderr}</pre>`
          )        
      }
      writeFileSync(
        path.join(dataFolder, name, "test-report", "report.json"),
        JSON.stringify({
          summary: {
            passed: 1,
            total
          },
        })
      );
      if (callback) callback();
    }
  );
}

function lint(name) {
  const directory = path.join(dataFolder, name, "test-report") 
  if (!isDirectory(directory)) {
    execSync(`cd data/${name} && mkdir test-report`);
  }
  exec(`cd data/${name} && npm run lint -- --no-fix`, (err, stdout, stderr) => {
    if (err) {
      console.log("lint err", err);
    }
    writeFileSync(
      path.join(directory, "report.json"),
      JSON.stringify({ lint: stdout })
    );
    writeFileSync(
      path.join(directory, "lint.log"),
      stdout
    );
  });
}

function clone(org, name, callback, force = false) {
  const directory = path.join(dataFolder, name);
  console.log("clone:", directory);
  if (isDirectory(directory)) {
    const key = `${org}/${name}`;
    const cacheTimeout = 60 * 5 * 1000;
    if (!force && key in lastChecked && new Date().getTime() - lastChecked[key] < cacheTimeout) {
      if (callback) callback();
      return;
    }
    exec(
      `cd ${directory} && \
git reset --hard HEAD && \
git pull --rebase`,
      () => {
        lastChecked[key] = new Date().getTime();
        if (callback) callback();
      }
    );
  } else {
    exec(
      `cd ${dataFolder} && \
git clone https://heg-web-bot:${GITHUB_TOKEN}@github.com/${org}/${name}.git`, (err, res) => {
      console.log("newclone", err, res);
      if (callback) callback();
    });
  }
}

function npmInstallLint(name) {
  exec(`cd data/${name} && npm install`, (err) => {
    if (err) {
      console.log("npm install err", err);
    }
    lint(name);
  });
}

function updateStatus(name, sha) {
  const r = JSON.parse(
    readFileSync(
      path.join(dataFolder, name, "test-report", "report.json")
    )
  );
  let passed = 0;
  let total = 0;
  // handle mocha
  if (r.stats) {
    passed = r.stats.passes;
    total = r.stats.tests;
    // handle pytest
  } else if (r.summary) {
    passed = r.summary.passed;
    total = r.summary.total;
  }
  const state = passed === total && total > 0 ? "success" : "failure";
  exec(`curl -X POST \
    https://api.github.com/repos/heg-web/${name}/statuses/${sha} \
    -H 'Authorization: token ${GITHUB_TOKEN}' \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    "state": "${state}",
    "target_url": "https://pweb.bf0.ch/results/${name}/",
    "description": "${passed}/${total} Tests passed",
    "context": "continuous-integration/pweb"
  }'`);
}

app.get("/api/test/statuses", (req, res) => {
  updateStatus(
    "algo-js-bfritscher",
    "ad653e8a3bff57dc02fe7bc3269809d32523ea41"
  );
  res.sendStatus(200);
});

app.get("/api/test/js/:name", (req, res) => {
  downloadAndTestJs(safeSuffix(req.params.name));
  res.sendStatus(200);
});

app.get("/api/test/py/:name", (req, res) => {
  downloadAndTestPy(safeSuffix(req.params.name));
  res.sendStatus(200);
});

app.get("/api/test/lint/:name", (req, res) => {
  res.sendStatus(200);
  res.end();
  const name = safeSuffix(req.params.name);
  clone('heg-web', name, () => {
    npmInstallLint(name);
  });
});

app.get("/api/test/search/:name", async (req, res) => {
  const result = await searchInFiles(path.join(dataFolder, safeSuffix(req.params.name)), ['.vue'], '$root');
  res.json(result);
});

app.get("/api/search/code", (req, res) => {
  const { extensions, query, org, name, infile } = parseInput(req.query.q);
  const delta = req.query.delta || 2;
  clone(safeSuffix(org), safeSuffix(name), async () => {
    try {
      let result;
      if (infile) {
        result = await searchInFiles(path.join(dataFolder, safeSuffix(name)), extensions, query, delta);
      } else {
        result = await searchFolderAndFiles(path.join(dataFolder, safeSuffix(name)), query);
      }
      res.json({
        total_count: result.length,
        items: result
      });
    } catch (e) {
      console.log(e);
      res.sendStatus(500);
    }
  });
});

app.get("/api/git/:name", (req, res) => {
  const name = safeSuffix(req.params.name);
  exec(`cd data/${name} && git log -1 --format='{"hash":"%H","date":"%aI"}'`, (error, stdout) => {
    res.header("Content-Type", 'application/json');
    res.send(stdout);
  });
});

app.get("/api/manual/:name", (req, res) => {
  // TODO refactor with webhook?
  const name = safeSuffix(req.params.name);
  if (name.includes("algojs")) {
    downloadAndTestJs(name, () => {
      res.sendStatus(200);
    });
  } else if (name.includes("algopy")) {
    downloadAndTestPy(name, () => {
      res.sendStatus(200);
    });
  } else if (name.includes("guessinggame")) {
    downloadAndBuildJava(name, () => {
      res.sendStatus(200);
    });
  } else {
    clone('heg-web', name, () => {
      npmInstallLint(name);
      res.sendStatus(200);
    }, true);
  }
});

app.post("/webhook", (req, res) => {
  console.log("WEBHOOK PAYLOAD", req.body);
  res.send("Got a POST request");
  if (req.body.repository.name.includes("algojs")) {
    downloadAndTestJs(req.body.repository.name, () => {
      if (req.body.head_commit) {
        updateStatus(req.body.repository.name, req.body.head_commit.id);
      }
    });
  } else if (req.body.repository.name.includes("algopy")) {
    downloadAndTestPy(req.body.repository.name, () => {
      if (req.body.head_commit) {
        updateStatus(req.body.repository.name, req.body.head_commit.id);
      }
    });
  } else if (req.body.repository.name.includes("guessinggame")) {
    downloadAndBuildJava(req.body.repository.name, () => {
      if (req.body.head_commit) {
        updateStatus(req.body.repository.name, req.body.head_commit.id);
      }
    });
  } else {
    clone('heg-web', safeSuffix(req.body.repository.name), () => {
      npmInstallLint(safeSuffix(req.body.repository.name));
    }, true);
  }
});

app.listen(8080, () => console.log("app listening on port 8080!"));
