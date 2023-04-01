/**
* Original code taken from https://github.com/nerdlabs/parse-attributes/blob/master/lib/index.js
* We are replicating it here to avoid having a smallish dependency which only parses a string
* @see https://github.com/nerdlabs/parse-attributes
*/

const reAttributes = /([\w\-]+)\s*=\s*(?:(?:(["'])((?:(?!\2).)*)\2)|([\w\-]+))|([\w\-]+)/g;

function camelCase(str) {
    return str.replace(/-([a-z])/g, function (_, letter) {
        return letter.toUpperCase();
    });
}

export default function parseAttributes(attrString) {
    let attributes = {};
    let match;
    let attrName = '';
    let attrValue;

    if (!attrString) return attributes;

    while (match = reAttributes.exec(attrString)) {
        attrName = match[1] || match[5];
        if (!attrName) continue;
        if (attrName.indexOf('-') !== -1) attrName = camelCase(attrName);
        attrValue = match[3] || match[4] || true;

        attributes[attrName] =
            attrValue === true ? true // Key exists but no value present, assume its just a flag attribute
            : isFinite(attrValue) ? +attrValue // Number line attribute
            : attrValue; // Treat everything else as strings
    }

    return attributes;
}
