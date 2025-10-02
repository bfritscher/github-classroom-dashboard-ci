const assert = require('chai').assert;
const parseInput = require('../src/parseInput');

describe('parseInput', () => {
    it('should parse a query', () => {
        const input = "$emit in:file extension:js extension:vue repo:heg-web/test";
        const { query, extensions, org, name, infile } = parseInput(input);
        assert.equal(query, "$emit");
        assert.deepEqual(extensions, [".js", ".vue"]);
        assert.equal(org, "heg-web");
        assert.equal(name, "test");
        assert.equal(infile, true);
    });
    it('should parse a query', () => {
        const input = "hello world extension:js  repo:heg-web/test extension:vue";
        const { query, extensions, org, name, infile } = parseInput(input);
        assert.equal(query, "hello world");
        assert.deepEqual(extensions, [".js", ".vue"]);
        assert.equal(org, "heg-web");
        assert.equal(name, "test");
        assert.equal(infile, false);
    });
    it('should not fail without extensions', () => {
        const input = "hello world";
        const { query, extensions, infile } = parseInput(input);
        assert.equal(query, "hello world");
        assert.equal(infile, false);
        assert.deepEqual(extensions, []);
    });
    it('should work with regex', () => {
        const input = "<title>(.*?)</title>";
        const { query, extensions, infile } = parseInput(input);
        assert.equal(query, "<title>(.*?)</title>");
        assert.equal(infile, false);
        assert.deepEqual(extensions, []);
    });
});
