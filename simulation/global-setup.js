const fs = require('fs');
const path = require('path');

module.exports = async () => {
  // Fresh run: clear previous bug log and store fixture.
  for (const f of ['report/bugs.json', 'fixtures/store.json', 'fixtures/creds.json']) {
    const p = path.join(__dirname, f);
    try { fs.unlinkSync(p); } catch {}
  }
};
