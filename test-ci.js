import fs from 'fs';
const obj = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));

let hasExtraneous = false;
for (const key of Object.keys(obj.packages)) {
    if (obj.packages[key].extraneous) {
        hasExtraneous = true;
        console.log("Extraneous found:", key);
    }
}
if (!hasExtraneous) {
    console.log("No extraneous packages found");
}
