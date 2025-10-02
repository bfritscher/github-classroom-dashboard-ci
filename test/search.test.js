const assert = require("chai").assert;
const fs = require("fs").promises;
const path = require("path");
const { searchInFiles, searchFolderAndFiles }  = require("../src/search");

describe("searchFiles", () => {
  const testDir = path.join(__dirname, "test");
  const testFiles = [
    {
      name: "file1.js",
      content:
        'line1\nif (test){\n    console.log("hello world twice hello world");\n}\nline4\nhello world\nline6',
    },
    { name: "file2.txt", content: "This is a test hello world file." },
    { name: "file3.js", content: 'console.log("goodbye world");' },
    { name: "subdir/file4.js", content: 'console.log("hello again");' },
    { name: "subdir/file5.js", content: 'console.log("hello world");' },
    { name: "node_modules/file6.js", content: 'console.log("hello node");' },
  ];

  before(async () => {
    await fs.mkdir(testDir);
    for (const file of testFiles) {
      const filePath = path.join(testDir, file.name);
      const fileDir = path.dirname(filePath);
      try {
        await fs.access(fileDir);
      } catch (err) {
        await fs.mkdir(fileDir, { recursive: true });
      }
      await fs.writeFile(filePath, file.content);
    }
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true });
  });

  it("should find a match in a file", async () => {
    const extensions = [".txt"];
    const regex = /hello world/;
    const expected = [
      {
        path: "file2.txt",
        line: 1,
        snippet: "This is a test <mark>hello world</mark> file.",
      },
    ];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it("should find a match in a file without regex", async () => {
    const extensions = [".txt"];
    const regex = "hello world";
    const expected = [
      {
        path: "file2.txt",
        line: 1,
        snippet: "This is a test <mark>hello world</mark> file.",
      },
    ];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it("should ignore node_modules", async () => {
    const extensions = [".js"];
    const regex = "hello node";
    const expected = [];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it("should work without extensions", async () => {
    const extensions = undefined;
    const regex = "test";
    const expected = [
      {
        line: 2,
        path: "file1.js",
        snippet:
          'line1\nif <mark>(test){</mark>\n    console.log("hello world twice hello world");',
      },
      {
        line: 1,
        path: "file2.txt",
        snippet: "This is a <mark>test</mark> hello world file.",
      },
    ];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it("should find a match in a subdirectory", async () => {
    const extensions = [".js"];
    const regex = /hello again/;
    const expected = [
      {
        path: path.join("subdir", "file4.js"),
        line: 1,
        snippet: '<mark>console.log("hello again");</mark>',
      },
    ];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it("should not find a match", async () => {
    const extensions = [".js"];
    const regex = /goodbye moon/;
    const expected = [];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it("should find multiple match in same and multiple files", async () => {
    const extensions = [".js"];
    const regex = /hello world/;
    const expected = [
      {
        path: "file1.js",
        line: 3,
        snippet:
          "if (test){\n" +
          '    <mark>console.log("hello world</mark> twice <mark>hello world");</mark>\n' +
          "}",
      },
      {
        path: "file1.js",
        line: 6,
        snippet: "line4\n<mark>hello world</mark>\nline6",
      },
      {
        path: path.join("subdir", "file5.js"),
        line: 1,
        snippet: '<mark>console.log("hello world");</mark>',
      },
    ];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it("should find multiple match with regex from text", async () => {
    const extensions = [".js"];
    const regex = "/console.log\(.*?\);/";
    const expected = [
      {
        line: 3,
        path: "file1.js",
        snippet:
          'if (test){\n    <mark>console.log("hello world twice hello world");</mark>\n}',
      },
      {
        line: 1,
        path: "file3.js",
        snippet: '<mark>console.log("goodbye world");</mark>',
      },
      {
        line: 1,
        path: path.join("subdir", "file4.js"),
        snippet: '<mark>console.log("hello again");</mark>',
      },
      {
        line: 1,
        path: path.join("subdir", "file5.js"),
        snippet: '<mark>console.log("hello world");</mark>',
      },
    ];
    const result = await searchInFiles(testDir, extensions, regex);
    assert.deepEqual(result, expected);
  });

  it('should return an array of file paths that match the regex', async () => {
    const regex = /.*.txt/;
    const expected = [
      { path: 'file2.txt', line: 0, snippet: 'file2.txt' }
    ];
    const result = await searchFolderAndFiles(testDir, regex);
    assert.deepEqual(result, expected);
  });

  it('should return files but not in blacklist', async () => {
    const regex = ".js";
    const expected = [
      { path: "file1.js", line: 0, snippet: "file1.js" },
      { path: "file3.js", line: 0, snippet: "file3.js" },
      { path: path.join("subdir", 'file4.js'), line: 0, snippet: path.join("subdir", 'file4.js') },
      { path: path.join("subdir", 'file5.js'), line: 0, snippet: path.join("subdir", 'file5.js') },
    ];
    const result = await searchFolderAndFiles(testDir, regex);
    assert.deepEqual(result, expected);
  });

  it('should return blacklist folder if specified', async () => {
    const regex = "node_modules";
    const expected = [
      { path: "node_modules", line: 0, snippet: "node_modules" },
    ];
    const result = await searchFolderAndFiles(testDir, regex);
    assert.deepEqual(result, expected);
  });


});


