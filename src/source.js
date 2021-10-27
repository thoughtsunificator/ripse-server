import Queueable from "./queueable.js"
import * as util from "../lib/util.js"

/**
 * @global
 */
class Source extends Queueable {

	/**
	 * @param {string} name
	 * @param {Engine} engine
	 */
	constructor(name, engine) {
		super()
		this._name = name
		this._engine = engine
		this._page = null
		this._loaded = false
		this._queuedTransactions = []
	}

	/**
	 * @param   {Transaction} transaction
	 * @returns {Promise}
	 */
	async enqueue(transaction) {
		this.engine.logger.log(`Enqueuing search to the queue...`)
		try {
			const cacheCollection = this.engine.database.collection("cache")
			transaction.data.imageMD5 = await util.md5Remote(transaction.data.imageURL)
			const cacheEntry = await cacheCollection.findOne({
				type: "source",
				sourceName: this.name,
				imageMD5: transaction.data.imageMD5,
				expireDate: {
					$gte: new Date()
				}
			})
			if(cacheEntry) {
				if(transaction.webSocket.readyState === 1) {
					this.engine.logger.log(`[${this.name}] Sending products data...`)
					transaction.send({ query: "search", data: cacheEntry.products })
				}
			} else {
				this._queuedTransactions.push(transaction)
				return super.enqueue(transaction)
			}
		} catch(ex) {
			this.engine.logger.error(ex)
		}
	}

	async load() {
		try {
			this._page = await this.engine.browser.newPage()
			await this.page.setViewport({ width: 1920, height: 1080 })
			await this.page.setRequestInterception(true)
			this.page.on('request', (request) => {
				if(request.resourceType() == 'stylesheet' || request.resourceType() == 'font' || request.resourceType() == 'image'){
					request.abort()
				} else {
					request.continue()
				}
			})
			await this.load_()
			this._loaded = true
		} catch(ex) {
			this.engine.logger.error(ex)
			this.engine.logger.log(`An error occuring while loading ${this.name}: Retrying...`)
			await new Promise(resolve => {
				setTimeout(async () => {
						await this.load()
						resolve()
				}, 10000)
			})
		}
	}

	/**
	 * @abstract
	 */
	async load_() {}

	async run() {
		if(!this.loaded) {
			return null
		}
		return await this.run_(...arguments)
	}

	/**
	 * @abstract
	 * @returns {*}
	 */
	async run_() {}

	/**
	 * @param {Transaction} transaction
	 */
	async task(transaction) {
		try {
			const cacheCollection = this.engine.database.collection("cache")
			const cacheEntry = await cacheCollection.findOne({
				type: "source",
				sourceName: this.name,
				imageMD5: transaction.data.imageMD5,
				expireDate: {
					$gt: new Date()
				}
			})
			this.engine.logger.log(`[${this.name}] Retrieving products...`)
			transaction.send({ query: "status", data: "Retrieving products..." })
			let products
			if(cacheEntry) {
				products = cacheEntry.products
			} else {
				products = await this.run(transaction)
				if(products) {
					if(products.length >= 1) {
						const date = new Date()
						await cacheCollection.insertOne({
							type: "source",
							sourceName: this.name,
							imageMD5: transaction.data.imageMD5,
							products,
							date,
							expireDate: new Date(date.getTime() + ((5 * 60) * 60000))
						})
					}
					if(transaction.webSocket.readyState === 1) {
						this.engine.logger.log(`[${this.name}] Sending products data...`)
						transaction.send({ query: "search", data: products })
					}
					for(const queuedTransaction of this._queuedTransactions) {
						queuedTransaction.send({ query: "status", data: `Queuing request: Your position is ${this.queue.items.length - 1}...` })
					}
				} else {
					this.engine.logger.log(`[${this.name}] An error occured while retrieving products data...`)
					transaction.send({ query: "status", data: `An error occured.` })
				}
			}
		} catch(ex) {
			this.engine.logger.error(ex)
		}
	}

	/**
	 * @readonly
	 * @type {string}
	 */
	get name() {
		return this._name
	}

	/**
	 * @readonly
	 * @type {Engine}
	 */
	get engine() {
		return this._engine
	}

	/**
	 * @readonly
	 * @type {Page}
	 */
	get page() {
		return this._page
	}

	/**
	 * @readonly
	 * @type {boolean}
	 */
	get loaded() {
		return this._loaded
	}

}

export default Source
