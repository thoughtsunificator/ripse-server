/**
 * @global
 */
class CurrencyConverter {

	/**
	 * @param {Browser} browser
	 * @param {object} logger
	 */
	constructor(browser, logger) {
		this._browser = browser
		this._logger = logger
		this._page = null
		this._from = null
		this._to = null
		this._rate = null
	}

	/**
	 * @param {string} from
	 * @param {string} to
	 */
	async load(from, to) {
		try {
			this._page = await this.browser.newPage()
			await this.page.setViewport({ width: 1920, height: 1080 })
			await this.page.setRequestInterception(true)
			this.page.on('request', (req) => {
				if(req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image'){
					req.abort()
				} else {
					req.continue()
				}
			})
			await this.page.setCookie(...[
				{
					name: "CONSENT",
					value: "YES+srp.gws-20211018-0-RC1.fr+FX+634",
					domain: '.google.com',
					secure: true
				}
			])
			await this.setCurrencyPair(from, to)
		} catch(ex) {
			this.logger.error(ex)
			this.logger.log(`An error occuring while loading currency-converter: Retrying in 10s...`)
			await new Promise(resolve => {
				setTimeout(async () => {
					await this.load()
					resolve()
				}, 10000)
			})
		}
	}

	/**
	 * @param {string} from
	 * @param {string} to
	 */
	async setCurrencyPair(from, to) {
		this.logger.log(`[currency-converter] Setting currency pair: ${from} to ${to}`)
		try {
			this._from = from
			this._to = to
			const page = await this.page.goto(`https://www.google.com/search?q=${1}+${from} to ${to}`)
			this.rate = new Number(await this.page.evaluate(() => document.querySelector('span[data-value]').getAttribute("data-value")))
			this.logger.log(`[currency-converter] Current rate for currency pair ${from} to ${to} is ${this.rate}`)
		} catch(ex) {
			this.logger.error(ex)
			this.logger.log(`An error occuring while setting currency pair: Retrying in 10s...`)
			await new Promise(resolve => {
				setTimeout(async () => {
						await this.setCurrencyPair(from, to)
						resolve()
				}, 10000)
			})
		}
	}

	/**
	 * @param {number} value
	 */
	convert(value) {
		try {
			return new Number(value * this.rate).toFixed(2)
		} catch(ex) {
			this.logger.error(ex)
			return null
		}
	}

	/**
	 * @readonly
	 * @type {Browser}
	 */
	get browser() {
		return this._browser
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
	get page() {
		return this._page
	}

	/**
	 * @readonly
	 * @type {string}
	 */
	get from() {
		return this._from
	}

	/**
	 * @readonly
	 * @type {string}
	 */
	get to() {
		return this._to
	}

	/**
	 * @readonly
	 * @type {number}
	 */
	get rate() {
		return this._rate
	}

	set rate(rate) {
		this._rate = rate
	}

}

export default CurrencyConverter
