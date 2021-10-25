/**
 * @global
 */
class Engine {

	/**
	 * @param {Browser}        browser
	 * @param {}               currencyConverter
	 * @param {}               logger
	 * @param {MongoClient.Db} database
	 */
	constructor(browser, currencyConverter, logger, database) {
		this._browser = browser
		this._currencyConverter = currencyConverter
		this._logger = logger
		this._database = database
	}
	/**
	 * @readonly
	 * @type {type}
	 */
	get browser() {
		return this._browser
	}

	/**
	 * @readonly
	 * @type {type}
	 */
	get currencyConverter() {
		return this._currencyConverter
	}

	/**
	 * @readonly
	 * @type {type}
	 */
	get logger() {
		return this._logger
	}

	/**
	 * @readonly
	 * @type {type}
	 */
	get database() {
		return this._database
	}

}

export default Engine
