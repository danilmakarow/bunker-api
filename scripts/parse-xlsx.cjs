const fs = require('fs');


const XLSX_DIR = '/tmp/bunker_xlsx';

// Parse shared strings
const sharedStringsXml = fs.readFileSync(`${XLSX_DIR}/xl/sharedStrings.xml`, 'utf8');

const stripTagsToText = (xmlSnippet) => {
  // Match <t>…</t> or <t xml:space="preserve">…</t>
  const matches = [...xmlSnippet.matchAll(/<t[^>]*>([^<]*)<\/t>/g)];
  return matches.map(m => m[1]).join('');
};

const sharedStrings = [];
const siMatches = [...sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)];
for (const m of siMatches) {
  sharedStrings.push(stripTagsToText(m[1]));
}

console.error('shared strings count:', sharedStrings.length);

// Parse workbook to know sheet names
const wbXml = fs.readFileSync(`${XLSX_DIR}/xl/workbook.xml`, 'utf8');
const sheets = [...wbXml.matchAll(/<sheet name="([^"]+)" sheetId="(\d+)" r:id="rId(\d+)"\/>/g)]
  .map(m => ({ name: m[1], sheetId: parseInt(m[2]), rId: parseInt(m[3]) }));

const colLetterToIndex = (letters) => {
  let result = 0;
  for (const ch of letters) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result - 1;
};

const parseSheet = (relId) => {
  // sheet file is named sheetN.xml where N maps to rId via _rels
  const filePath = `${XLSX_DIR}/xl/worksheets/sheet${relId}.xml`;
  const sheetXml = fs.readFileSync(filePath, 'utf8');
  const rowMatches = [...sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)];
  const rows = [];
  for (const rm of rowMatches) {
    const rowNum = parseInt(rm[1]);
    const cellMatches = [...rm[2].matchAll(/<c r="([A-Z]+)\d+"(?:\s+s="\d+")?(?:\s+t="([^"]+)")?[^/>]*(?:\/>|>([\s\S]*?)<\/c>)/g)];
    const cells = [];
    for (const cm of cellMatches) {
      const col = colLetterToIndex(cm[1]);
      const type = cm[2];
      const inner = cm[3] || '';
      let value = '';
      const vMatch = inner.match(/<v>([^<]*)<\/v>/);
      const isMatch = inner.match(/<is>([\s\S]*?)<\/is>/);
      if (vMatch) {
        if (type === 's') {
          value = sharedStrings[parseInt(vMatch[1])];
        } else {
          value = vMatch[1];
        }
      } else if (isMatch) {
        value = stripTagsToText(isMatch[1]);
      }
      cells[col] = value;
    }
    rows.push({ rowNum, cells });
  }
  return rows;
};

const output = {};
for (const sheet of sheets) {
  try {
    output[sheet.name] = parseSheet(sheet.rId);
  } catch (e) {
    output[sheet.name] = { error: e.message };
  }
}

console.log(JSON.stringify(output, null, 2));
