import {fileURLToPath} from 'node:url';
import DoopParser from '#lib/parser';

// Determine if the URL we are examining is a .doop file index
let testIndex = url => /\.doop$/.test(url);

// Determine if the URL we are examining is a .doop file block by name
let testBlock = url => /\.doop\?block=(?<block>.+)$/.test(url);

// Actually extract the block we are after
let extractBlock = url => /\.doop\?block=(?<block>.+)$/.exec(url).groups || {};

/**
* Active parsers we have running at once
* This is to prevent parsing the same .doop file multiple times - as it will export an index + each block seperately
* @type {Object<DoopParser>} An object where each key is the source file URL
*/
let parsers = {};


export default {
	resolve(url) {
		if (!testIndex(url) && !testBlock(url)) return; // Not handled by this module
		return {url};
	},

	// Identify all .doop files as modules
	format(url) {
		if (!testIndex(url) && !testBlock(url)) return; // Not handled by this module
		return {format: 'module'};
	},

	// Fetch the file contents
	async fetch(url) {
		if (!testIndex(url) && !testBlock(url)) return; // Not handled by this module

		if (!parsers[url]) {
			parsers[url] = new DoopParser(fileURLToPath(url));
			await parsers[url].parse(); // Read in the file
		}

		if (testIndex(url)) {
			return {source: parsers[url].index({url: true})};
		} else {
			let {block} = extractBlock(url);
			if (!block) throw new Error(`Unable to parse extractable block ID from "${url}"`);

			return {source: parsers[url].getSource(block)};
		}
	},

	transform(source) {
		return {source};
	},
};
