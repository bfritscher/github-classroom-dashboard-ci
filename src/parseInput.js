function parseInput(input) {
    const infile = input.includes('in:file');
    input = input.replaceAll('in:file', '');
    let extensions = [];
    const match = input.match(/extension:[^ ]+/g)
    if(match){
        extensions = match.map(ext => `.${ext.slice(10)}`);
    }
    const matchRepo = input.match(/repo:[^ ]+/)
    let org, name;
    if(matchRepo){
        [org, name] = matchRepo[0].slice(5).split('/');
    }
    const query = input.replaceAll(/extension:[^ ]+/g, '').replaceAll(/repo:[^ ]+/g, '').trim();
    return { query, extensions, org, name, infile };
  }

module.exports = parseInput;