import { SVGToBox2D } from "./SVGToBox2D"
import { WorldRunner } from "./WorldRunner"
import { WorldRenderer, ImageDef, ImageDefMap } from "./WorldRenderer"
import * as AppEventAdapter from "app-event-adapter"

/**
 * This class is only concerned with the general tasks of starting a Box2D-SVG-JSSynth-Game scenario.
 * 
 * Extend this class to create a game.
 * 
 * @returns {mite.game.Scenario}
 */
export class Scenario {

	svg: SVGElement
	canvas: HTMLCanvasElement
	frameRate: number
	sprites: {[key: string]: HTMLImageElement}
	backgrounds: {[key: string]: HTMLImageElement}
	fixedImages: {[key: string]: HTMLImageElement}
	simulationEnabled: boolean
	renderingEnabled: boolean
	running: boolean
	svgConverter: SVGToBox2D
	runningInterval: number
	appEventAdapter: AppEventAdapter

	worldRenderer: WorldRenderer
	worldRunner: WorldRunner

	constructor() {
		this.frameRate = 60;

		//Load the first svg and the first canvas by default.
		this.svg = document.getElementsByTagName("svg")[0];
		this.canvas = document.getElementsByTagName("canvas")[0];
		
		this.svgConverter = new SVGToBox2D();
		this.worldRunner = new WorldRunner();

		let sprites = this.generateImageDefMapFromAnHTMLParentTag(document.getElementById("sprites"))
		let backgrounds = this.generateImageDefMapFromAnHTMLParentTag(document.getElementById("backgrounds"))
		let fixed = this.generateImageDefMapFromAnHTMLParentTag(document.getElementById("fixed"))

		this.worldRenderer = new WorldRenderer(this.canvas, sprites, backgrounds, fixed);
		
		this.appEventAdapter = new AppEventAdapter(this.canvas);
		
		this.simulationEnabled = true;
		this.renderingEnabled = true;
	}

	/**
	 * Start/unpause the game loop
	 */
	start() {
	this.running = true
	var self = this
	this.runningInterval = setInterval(function() {self.step();}, Math.round(1000/self.frameRate))
}

	/**
	 * Pause the game loop
	 */
	stop() {
		clearInterval(this.runningInterval)
		this.running = false
	};

	/**
	 * Internal. Steps the world forward and draws it
	 */
	step = function() {
		if (this.simulationEnabled) {
			this.worldRunner.step()
		}
		if (this.renderingEnabled) {
			this.worldRenderer.drawWorld(this.worldRunner.world)
		}
	}

	/**
	 * Gets a map of image element IDs.
	 * 
	 * @param containerElem a DOM element that contains the game images to read in.
	 * @param imageMap map of image names to settings {name: {img: Element, scale: number, pos: Position, disabled: boolean},...} 
	 */
	generateImageDefMapFromAnHTMLParentTag(containerElem): ImageDefMap {
		let map: ImageDefMap = {}
		if (containerElem) {
			var i, img, imageElements = containerElem.getElementsByTagName("img")
			for (i=0; i<imageElements.length; i++) {
				img = imageElements[i]
				if (img.id) {
					map[img.id] = this.convertImageTagToImageDef(img)
				}
			}
		}
		return map
	}

	/**
	 * Internal converter from a DOM image element into a sprite or background image list entry.
	 * @param img Element to convert
	 * @returns image entry object {img: Element, scale: number, pos: Position, disabled: boolean}
	 */
	convertImageTagToImageDef(img: HTMLImageElement): ImageDef {
		var scaleAttr, posAttr, posParts, disabledAttr
		var entry = {
			img: img, 
			scale: 1, 
			disabled: false,
			x: 0,
			y: 0
		}

		scaleAttr = img.getAttribute("data-scale")
		if (scaleAttr) {
			entry.scale = scaleAttr * 1
		}
		posAttr = img.getAttribute("data-pos")
		if (posAttr) {
			posParts = posAttr.split(",")
			entry.x = posParts[0] * 1
			entry.y = posParts[1] * 1
		}
		disabledAttr = img.getAttribute("data-disabled")
		if (disabledAttr && disabledAttr === "true") {
			entry.disabled = true;
		}
		return entry;
	}
}