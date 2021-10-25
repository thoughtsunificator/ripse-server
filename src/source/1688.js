import fs from 'fs'
import { nanoid } from "nanoid"

import * as util from "../../lib/util.js"

import Source from "../source.js"

/**
 * @global
 */
class _1688 extends Source {

	/**
	 * @param {Engine} engine
	 */
	constructor(engine) {
		super("1688", engine)
	}

	async load_() {
		this._page = await this.engine.browser.newPage()
		await this.page.setRequestInterception(true)
		this.page.on('request', (request) => {
			if(request.resourceType() == 'stylesheet' || request.resourceType() == 'font' || request.resourceType() == 'image'){
				request.abort()
			} else {
				request.continue()
			}
		})
		await this.page.goto(`https://s.1688.com/youyuan/index.htm`)
		await this.page.waitForSelector('.space-image-upload input[type="file"]')
	}

	/**
	 * @param {Transaction} transaction
	 * @returns {array}
	 */
	async run_(transaction) {
		const products = await this.uploadImage(transaction)
		if(!products) {
			return null
		}
		transaction.send({ query: "status", data: `Found ${products.length} products. Converting currency...` })
		for(const product of products) {
			product.currency.brazilian = this.engine.currencyConverter.convert(product.currency.chinese)
		}
		return products
	}

	/**
	 * @param {Transaction} transaction
	 * @returns {array}
	 */
	async uploadImage(transaction) {
		let products = null
		let filepath
		try {
			filepath = `temp/${nanoid()}`
			transaction.send({ query: "status", data: `Downloading image to file...` })
			this.engine.logger.log(`[1688] Downloading image ${transaction.data.imageURL} to ${filepath}...`)
			await util.download(transaction.data.imageURL, filepath)
			const inputNode = await this.page.$('.space-image-upload input[type="file"]')
			this.engine.logger.log(`[1688] Uploading image ${filepath} to 1688 search engine...`)
			transaction.send({ query: "status", data: `Uploading image ${filepath} to 1688 search engine...` })
			await inputNode.uploadFile(filepath)
			await this.page.waitForNavigation({waitUntil: 'networkidle2'})
			await this.page.waitForSelector('.space-offer-card-box')
			products = await this.page.$$eval('#sm-offer-list .space-offer-card-box', elements => {
				return elements.map(element => ({
					name: element.querySelector(".title").textContent,
					src: element.querySelector(".img").style.backgroundImage.slice(5, -2),
					url: element.querySelector(".mojar-element-image a").href,
					currency: {
						chinese: element.querySelector(".price") ?  element.querySelector(".price").textContent.replace(/[^0-9.,]/, "") : null
					}
				}))
			})
		} catch(ex) {
			this.engine.logger.error(ex)
		} finally {
			fs.unlinkSync(filepath)
		}
		return products
	}

}

export default _1688
