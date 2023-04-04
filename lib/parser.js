import {createReadStream} from 'node:fs';
import EventEmitter from 'node:events';
import {pathToFileURL} from 'node:url';
import parseAttributes from '#lib/parseAttributes';

/**
* Default options passed to each method
* @type {Object<Object>} An object with each key as the method name an the inner-object being the function defaults
*/
export let defaults = {
	getSource: {
		asString: true,
	},
	index: {
		globalEmitter: 'app',
		wrap({block, path, settings}) {
			if (block.attrs.on) {
				return `${settings.globalEmitter}.on('${block.attrs.on}', ()=> import('${path}'));`;
			} else {
				return `await import('${path}');`;
			}
		},
		url: false,
	},
	parse: {
		orphans: false,
		aliases: {
			'endpoint': { attrs: { on: 'endpoint' }},
			'middleware': { attrs: { on: 'middleware' }},
		},
		getId(block) {
			if (block.attrs.id) { // Use stated ID
				if (this.blocks[block.attrs.id]) throw new Error(`Duplicate block ID "${block.attrs.id}"`);
				return block.attrs.id;
			} else { // Try to guess tag from on mapping || tag + offset
				let tag = block.attrs.on || block.tag;

				if (!this.idTags) this.idTags = {};
				if (!this.idTags[tag]) this.idTags[tag] = 0;
				return tag + this.idTags[tag]++;
			}
		},
	},
}


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
	* @property {Array<String>} source Source code parsed for the block
	* @property {Array<String>} sourceHeaders Extracted top-level header elements like `import` statements
	*/
	blocks = {};


	matchers = {
		matchStart: /^<(?<tag>[a-z0-9-]+)(?<attrs>\s*.+?\s*)?>$/i,
		matchEnd: /^<\/[a-z0-9-]+>$/i,
	}


	/**
	* Initiate parsing of the input file
	* @param {Object} [options] Additional options to mutate behaviour
	* @param {Boolean} [otions.orphans=false] Indicate that the `orphanedLines` emit should trigger if we discover lines, since this includes some processing its disabled by default
	* @param {Object} [aliases] Alias tags, when a key is detected the value is merged into the block specification
	* @param {Function} [getId] Function which should return a generated ID for imports that don't explicitly specify one
	* @returns {Promise<DoopParser>} A promise when the file parse has concluded and the blocks have been computed. Will resolve with this parser instance
	*/
	parse(options) {
		let settings = {...defaults.parse, ...options};

		let buf = []; // Current read buffer in a line array
		let bufExamineOffset = 0; // From where in the buffer should we search for new matches
		let currentBlock;
		let linesSeen = 0; // Additional lines we have disposed of or already processed, used to track the actual line offset

		return new Promise((resolve, reject) =>
			createReadStream(this.path)
				.on('data', data => {
					// Handle incoming partial data {{{
					let dataLines = data.toString().split(/\n/);
					if (buf.length > 0) { // Partial buffer is present
						buf[buf.length -1] += dataLines.at(0); // Append incoming partial line to last line of buffer
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

								// Handle aliases {{{
								Object.entries(settings.aliases)
									.filter(([key, val]) => attrs[key] === true && val.attrs)
									.forEach(([key, val]) => {
										delete attrs[key]; // Remove alias key
										Object.assign(attrs, val.attrs); // Merge attrs payload
									})
								// }}}

								let newBlock = {
									tag,
									attrs,
									lineStart: linesSeen + matchIndex + 2,
									lineEnd: 0,
									source: [],
									sourceHeaders: [],
								}
								let id = settings.getId.call(this, newBlock);
								currentBlock = this.blocks[id] = {
									id,
									...newBlock,
								};

								// Deal with orphaned content
								linesSeen += matchIndex + 1;
								let orphans = buf.splice(0, matchIndex + 1);
								if (settings.orphans) {
									orphans.shift();
									orphans.pop(); // Remove final closing tag
									if (orphans.some(Boolean)) this.emit('orphanedLines', orphans); // Non-empty orphaned content? Emit it
								}

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
								currentBlock.source = buf.splice(0, matchIndex + bufExamineOffset);
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
	* Get the sourcecode of a named block, optionally applying transforms
	* @param {String} id Block ID to work with
	* @param {Object} [options] Additional options to mutate behaviour
	* @param {Boolean} [options.asString=true] Return the source as a pure string instead of an array
	* @returns {String} The output source code of the block
	*/
	getSource(id, options) {
		let settings = {...defaults.getSource, ...options};

		let source = this.blocks[id]?.source;
		if (!source) throw new Error(`Unknown source block "${id}"`);

		// Include headers
		source = [
			...this.blocks[id].sourceHeaders,
			...source,
		];

		if (settings.asString) source = source.join('\n');

		return source;
	}


	/**
	* Generate an index file based on the parsed blocks
	*
	* @param {Object} [options] Additional options to mutate behaviour
	* @param {String} [options.globalEmitter='app'] Emitter to bind to if `wrap` uses its default behaviour
	* @param {Boolean} [options.url=false] Return the path mappings as URLs instead of simple filesystem paths
	* @param {Function} [options.wrap] Function to return the final output of each import line, defaults to a simple `import 'X';` if no `attr.on` specified, otherwise binds to the `globalEmitter`. Called as `({block, path})`
	* @returns {String} Generated source code pointing to each extracted block as a relative path
	*/
	index(options) {
		let settings = {...defaults.index, ...options};

		let blockPath = settings.url
			? pathToFileURL(this.path)
			: this.path;

		let result = [
			'/* Generated index file via doop/esm-loader */',
			'',
			'import "@doop/esm-loader/app";',
			'',
			...Object.values(this.blocks)
				.map(block =>
					settings.wrap({
						block,
						path: `${blockPath}?block=${block.id}`,
						settings,
					})
				)
		]
			.join('\n')

		// console.log('INDEX [[[', result, ']]]');
		return result;
	}


	constructor(path) {
		super(); // Instanciate EventEmitter
		this.path = path;
	}
}
