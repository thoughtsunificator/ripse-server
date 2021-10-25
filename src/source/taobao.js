import fs from 'fs'
import { nanoid } from "nanoid"

import * as util from "../../lib/util.js"

import Source from "../source.js"

/**
 * @global
 */
class Taobao extends Source {

	/**
	 * @param {Engine} engine
	 */
	constructor(engine) {
		super("taobao", engine)
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
		await this.page.goto(`https://www.google.com/search?q=site:taobao.com&tbm=isch`)
		await this.page.waitForXPath("/html/body/c-wiz/div/header/div[2]/div/div[1]/form/div[1]/div[2]/div/div[3]/div/span")
	}

	/**
	 * @param {Transaction} transaction
	 * @returns {array}
	 */
	async run_(transaction) {
		let images = null
		let filepath
		try {
			filepath = `temp/${nanoid()}`
			transaction.send({ query: "status", data: `Downloading image to file...` })
			this.engine.logger.log(`[taobao] Downloading image ${transaction.data.imageURL} to ${filepath}...`)
			await util.download(transaction.data.imageURL, filepath)
			const [button] = await this.page.$x("/html/body/c-wiz/div/header/div[2]/div/div[1]/form/div[1]/div[2]/div/div[3]/div/span")
			if (button) {
				await button.click()
			}
			const inputNode = await this.page.$('input[type="file"]')
			this.engine.logger.log(`[taobao] Uploading image ${filepath} to 1688 search engine...`)
			transaction.send({ query: "status", data: `Uploading image ${filepath} to 1688 search engine...` })
			await inputNode.uploadFile(filepath)
			await this.page.waitForNavigation({waitUntil: 'networkidle2'})
			await this.page.waitForSelector('img[src^="data"]')
			images = await this.page.$$eval('img[src^="data"]', elements => {
				return elements.map(element => ({
					name: "Test",
					url: element.parentNode.parentNode.href,
					src: element.src,
					currency: {
						brazilian: "Test",
						chinese: "Test"
					}
				}))
			})
		} catch(ex) {
			this.engine.logger.error(ex)
		} finally {
			fs.unlinkSync(filepath)
		}
		return images
	}

}

export default Taobao
