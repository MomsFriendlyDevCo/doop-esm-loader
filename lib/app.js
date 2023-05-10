/**
* Basic implementation of a global `app` object
* If `global.app` doesn't already exist its instanciated from this base class
*
* This is used as a emitter to attach to if any Doop blocks contain a `on` specifier
*
* This is a very basic bare-bones app object which is expected to be sub-classed by something more specific to purpose
*/

import _ from 'lodash';
import Debug from 'debug';
import Eventer from '@momsfriendlydevco/eventer';

const debug = Debug('doop');

export class DoopApp {


	/**
	* Indicates if this instance exists within a produciton environment
	* If this is the case some dev checks are skipped
	* @type {Boolean}
	*/
	isProduction = process.NODE_ENV == 'production';


	/**
	* Generic sub-system storage for things loaded against app that don't need to live at the top level e.g. @momsfriendlydevco/expressy
	* @type {Object}
	*/
	subsystems = {};


	/**
	* Generic middleware storage
	* Loaded middleware is expected to decorate this object
	* e.g. `app.middleware.express.static(dir)` manages staic files
	* @type {Object}
	*/
	middleware = {express: {}, db: {}};


	/**
	* Scan over all events and try to execute them in a logical order
	* This function is expected to be subclassed by something more specific to purpose
	*
	* Note: The sequence executed automatically gets decorated with `pre*` and `post*` at each stage
	*       e.g. if sequence=['stuff'] the actual emitters map to ['preStuff', 'stuff', 'postStuff']
	*
	* @param {Array<String>} [sequence] The sequence to execute, defaults to `init,middleware,endpoint,server,ready` if omitted
	* @returns {Promise} A promise which resolves when all emitters have completed
	*/
	emitSequence(sequence) {
		sequence ||= ['init', 'middleware', 'endpoint', 'server', 'ready'];

		debug('EmitSequence');
		return sequence
			.flatMap(stage => [
				'pre' + stage.substr(0, 1).toUpperCase() + stage.substr(1),
				stage,
				'post' + stage.substr(0, 1).toUpperCase() + stage.substr(1),
			])
			.reduce((acc, stage) => // Series promise for all stages
				acc.then(()=> {
					debug(`STAGE: ${stage}`);
					return this.emit(stage, this)
				})
			, Promise.resolve())
	}


	/**
	* Simple method to extend the App prototype while also checking for conflicts
	* @param {String} [path=''] The path to extend from, can use dotted notation
	* @param {Object} mixin The mixin object to extend by, if path is specified that is used as the root within `app`
	* @param {Object} [options] Additional options to mutate behaviour
	* @param {String} [options.path] Alternate method to specify `path`
	* @param {Boolean} [options.overwrite=false] Allow overwriting of existing keys
	* @param {Object} [options.target=this] Target object to exend, defaults to this app object
	* @returns {Object} This chainable instance
	*
	* @example Extend app with a top-level object
	* app.extend({
	* 	thing: {
	* 		func1: ()=> { ... },
	* 		func2: ()=> { ... },
	* 	},
	* })
	* app.thing.func1() //= result of that function
	*
	* @example Add a deep object into app
	* app.extend('utils.stuff.things.widgets', ()=> { ... });
	* app.utils.stuff.things.widgets() //= result of that function
	*/
	extend(path, mixin, options) {
		// Argument mangling {{{
		if (typeof path != 'string') [path, mixin, options] = [null, path, mixin]; // No path - shift right
		// }}}

		let settings = {
			path,
			overwrite: false,
			target: this,
			...options,
		};

		if (!settings.overwrite && this.isProduction)
			Object.keys(mixin)
				.forEach(key => {
					if (this[key]) throw new Error(`The key "${key}" is already specifed in global.app - either specify {overwrite:true} or resolve the conflict`);
				})

		if (settings.path) {
			_.set(settings.target, settings.path, mixin);
		} else {
			Object.assign(settings.target, mixin);
		}

		return this;
	}


	/**
	* Base constructor
	* Extend this instance with eventer
	*/
	constructor() {
		Eventer.extend(this);
	}
}

if (!global.app) {
	debug('Initalizing base DoopApp for the first time');
	global.app = new DoopApp();
}
