import {createReadStream} from 'node:fs';
import EventEmitter from 'node:events';
import parseAttributes from '#lib/parseAttributes';

/**
* Doop SFC file parser
*
* @emits orphanedLines Emitted when orphaned source code lines are detected. Emitted as `(lines: Array<String>)`
*/
export default class DoopParser extends EventEmitter {
	/**
	* Source file path to read
	* @type {String}
	*/
	path;


	/**
	* Parsed code blocks by ID
	* @type {Object<Object>}
	* @property {String} id The ID of the block (also the key of the object)
	* @property {String} tag The main tag name of the block
	* @property {Object} attrs Attributes allocated to the block, parsed from the block descriptor
	* @property {Number} lineStart The line number offset in the source file
	* @property {Number} lineEnd The ending line number offset in the source file
	* @property {String} source Source code parsed for the block
	*/
	blocks = {};


	matchers = {
		matchStart: /^<(?<tag>[a-z0-9-]+)(?<attrs>\s*.+?\s*)?>$/i,
		matchEnd: /^<\/[a-z0-9-]+>$/i,
	}


	/**
	* Initiate parsing of the input file
	* @returns {Promise<DoopParser>} A promise when the file parse has concluded and the blocks have been computed. Will resolve with this parser instance
	*/
	parse(options) {
		let buf = []; // Current read buffer in a line array
		let bufExamineOffset = 0; // From where in the buffer should we search for new matches
		let currentBlock;
		let genericTags = {}; // Lookup of tag to the number of times an unnamed element has been used. This is to track blocks without an ID and guess the correct offset
		let linesSeen = 0; // Additional lines we have disposed of or already processed, used to track the actual line offset

		return new Promise((resolve, reject) =>
			createReadStream(this.path)
				.on('data', data => {
					// Handle incoming partial data {{{
					let dataLines = data.toString().split(/\n/);
					if (buf.length > 0) { // Partial buffer is present
						buf.at(-1) += dataLines.at(0); // Append incoming partial line to last line of buffer
						dataLines.shift(); // Remove handled dataLine
						bufExamineOffset = buf.length + dataLines.length - 1;
					} else {
						bufExamineOffset = 0;
					}
					buf.push(...dataLines);
					// }}}

					let actions; // Actions performed in this loop. Will exit when no more actions are performed
					do {
						actions = 0; // Reset action counter

						// Not yet in a block - Consider starting a new block {{{
						if (!currentBlock) { // Not yet in a block
							// Find the start of the next block {{{
							let matchIndex = buf
								.slice(bufExamineOffset)
								.findIndex(line => this.matchers.matchStart.test(line))

							if (matchIndex > -1) {
								let {tag, attrs} = this.matchers.matchStart.exec(buf[matchIndex])?.groups || {};
								tag = tag.toLowerCase();
								attrs = parseAttributes(attrs);

								let id;
								if (attrs.id) { // Use stated ID
									if (this.blocks[attrs.id]) throw new Error('Duplicate block ID "${attrs.id}"');
									id = attrs.id;
								} else { // Try to guess tag from tag + offset
									if (!genericTags[tag]) genericTags[tag] = 0;
									id = tag + genericTags[tag]++;
								}

								currentBlock = this.blocks[id] = {
									id,
									tag,
									attrs,
									lineStart: linesSeen + matchIndex + 2,
									lineEnd: 0,
									source: '',
								};

								// Deal with orphaned content
								linesSeen += matchIndex + 1;
								let orphans = buf.splice(0, matchIndex + 1);
								orphans.shift();
								orphans.pop(); // Remove final closing tag
								if (orphans.some(o => o)) this.emit('orphanedLines', orphans); // Non-empty orphaned content? Emit it

								// Reset pointer
								bufExamineOffset = 0;

								// Note that we did something - queue up next iteration
								actions++;
							} // Implied else - no opening tag found - wait until next on('data') call to slurp in more data
							// }}}
						}
						// }}}

						// In a block - search for end, if any so far {{{
						if (currentBlock) {
							let matchIndex = buf
								.slice(bufExamineOffset)
								.findIndex(line => this.matchers.matchEnd.test(line))

							if (matchIndex > -1) { // Found end point
								linesSeen = currentBlock.lineEnd = linesSeen + matchIndex + bufExamineOffset;
								currentBlock.source = buf.splice(0, matchIndex + bufExamineOffset).join('\n');
								currentBlock = null;

								// Note that we did something - queue up next iteration
								actions++;
							} // Implied else - No end point available yet
						}
						// }}}
					} while (actions > 0)
				})
				.on('close', ()=> resolve())
				.on('error', reject)
		)
			.then(()=> this)
	}


	/**
	* Generate an index file based on the parsed blocks
	* @returns {String} Generated source code pointing to each extracted block as a relative path
	*/
	index() {
		return [
			'/* Generated index file from @doop/esm-loader */',
			...Object.values(this.blocks)
				.map(block => `import ${block.id} from '${this.path}?block=${block.id}'`)
		]
			.join('\n')
	}


	constructor(path) {
		super(); // Instanciate EventEmitter
		this.path = path;
	}
}
