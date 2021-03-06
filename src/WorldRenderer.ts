import * as planck from "planck-js"

export interface ImageDef {
	img: HTMLImageElement, 
	scale: number, 
	disabled: boolean,
	x: number,
	y: number
}

export interface ImageDefMap {
	[key: string]: ImageDef
}

export class WorldRenderer {

	context: CanvasRenderingContext2D
	canvas: HTMLCanvasElement
	oid: number
	worldWidth: number
	worldHeight: number
	sprites: ImageDefMap
	fixedImages: ImageDefMap
	backgroundImages: ImageDefMap
	transition: {dx: number, dy: number, ds: number, numFrames: number}
	currentScale: number
	translateX: number
	translateY: number
	minScale: number
	maxScale: number

	//These three are updated on resize:
	viewPortDimensions: {w: number, h: number};
	topLeft: {x: number, y: number};
	bottomRight: {x: number, y: number};

	effects: {[key: string]: any}

	/**
	 * This class takes a canvas and a World object from box2d and
	 * draws the box2d world onto the canvas.
	 * 
	 * @param canvas
	 * @param width
	 * @param height
	 * @returns {mite.box2d.WorldRenderer}
	 */	
	constructor(canvas: HTMLCanvasElement, sprites: ImageDefMap, fixedImages: ImageDefMap, backgroundImages: ImageDefMap) {
		this.context = canvas.getContext('2d')
		this.canvas = canvas
		this.oid = Math.random()
		this.worldWidth = null
		this.worldHeight = null
		
		this.sprites = sprites
		
		this.backgroundImages = backgroundImages
		
		this.fixedImages = fixedImages

		this.transition = {dx: 0, dy: 0, ds: 0, numFrames: 0}
		
		var self = this
		window.addEventListener("resize", () => {
			this.resize()
		});
		
		this.effects = {}
	};

	load(worldData) {
	
		this.transition = {dx: 0, dy: 0, ds: 0, numFrames: 0}
		
		this.currentScale = 1
		this.translateX = 0
		this.translateY = 0

		//These three are updated on resize:
		this.viewPortDimensions = {w: 0, h: 0}
		this.topLeft = {x: 0, y: 0}
		this.bottomRight = {x: 0, y: 0}
		
		this.worldWidth = worldData.size.x
		this.worldHeight = worldData.size.y
		this.resize()
		this.setScale(this.minScale)
		
		//put ground at bottom of screen:
		this.translate(0, this.viewPortDimensions.h - this.worldHeight)
	};

	resize() {
	
		var holder = document.getElementById("canvasHolder")
		
		this.canvas.width = holder.clientWidth
		this.canvas.height = holder.clientHeight
		
		//reset to current scale after resize:
		var widthScale = this.canvas.width / this.worldWidth
		var heightScale = this.canvas.height / this.worldHeight
		
		this.minScale = Math.min(widthScale, heightScale)
		this.maxScale = 20
		
		this.updateViewPort()
	}

	setScale = function(newScale) {
		this.scaleBy(newScale / this.currentScale)
	}

	scaleBy = function(amount, pos) {
		if (!pos) pos = {x: 0, y: 0}
		
		var newScale = this.currentScale * amount
		if (newScale >= this.minScale / 2 && newScale <= this.maxScale) {
			
			var move = this.calculateTranslateForZoom(this.topLeft, this.viewPortDimensions, pos, amount)
			
			this.translate(-move.x, -move.y)
			
			this.currentScale = newScale
			this.updateViewPort()
		}
	}

	calculateTranslateForZoom = function(
		topLeftViewportWorldCoordinates, viewportWorldDimensions, zoomCenterWorldCoordinates, scale) {
	
		var zoomFactor = scale - 1;//zoomFactor of 0 is no change to zoom.
		var differenceInCanvasWidth = viewportWorldDimensions.w * zoomFactor;
		var howFarAcrossTheScreenItIs = zoomCenterWorldCoordinates.x - topLeftViewportWorldCoordinates.x;
		var proportionAcrossScreen = howFarAcrossTheScreenItIs / viewportWorldDimensions.w;
		
		var howFarToMoveAcross = differenceInCanvasWidth * proportionAcrossScreen;
		
		
		var differenceInCanvasHeight = viewportWorldDimensions.h * zoomFactor;
		var howFarDownTheScreenItIs = zoomCenterWorldCoordinates.y - topLeftViewportWorldCoordinates.y;
		var proportionDownScreen = howFarDownTheScreenItIs / viewportWorldDimensions.h;
		
		var howFarToMoveDown = differenceInCanvasHeight * proportionDownScreen;
		
		return {x: howFarToMoveAcross, y: howFarToMoveDown};
	};

	translate = function(x, y) {
		this.translateX += x;
		this.translateY += y;
		this.updateViewPort();
	};

	zoomToFit = function(x, y, width, height, numFrames) {
		//The smallest scale that can fit the width and the height of the target.
		
		var scale = Math.min(
			this.canvas.width / width,
			this.canvas.height / height);
		console.debug("zooming to: ", x + (width/2), ",", y + (height/2), " - ", width, ",", height, " - scale: ", scale, ", numFrames: ", 50);
		this.transitionTo(x + (width/2), y + (height/2), scale, numFrames);
	};

	transitionTo = function(x, y, scale, numFrames) {
		if (this.transition.numFrames < 1) {
			this.transition.targetX = x;
			this.transition.targetY = y;
			this.transition.targetScale = scale;
			this.transition.dx = (this.translateX - x) / numFrames;
			this.transition.dy = (this.translateY - y) / numFrames;
			this.transition.ds = ((scale - this.currentScale) / numFrames) + 1;
			this.transition.numFrames = numFrames;
			
			console.debug("current pos: ", this.translateX, ",", this.translateY, "delta: ", this.transition.dx, ",", this.transition.dy);
			console.debug("current scale: ", this.currentScale, " -> ", this.transition.ds);
		}
	};

	stepTransition = function() {
		if (this.transition.numFrames === 1) {
	//		this.translateX = this.transition.targetX;
	//		this.translateY = this.transition.targetY;
	//		this.setScale(this.transition.targetScale);
			
			this.transition.numFrames = 0;
		}
		else if (this.transition.numFrames > 1) {
			this.scaleBy(this.transition.ds);
			this.translate(this.transition.dx / this.currentScale, this.transition.dy / this.currentScale);
			this.transition.numFrames--;
		};
	};

	getWorldCoordinatesFromPixelCoordinates = function(pos) {
		var worldPos = {x: 0, y: 0};
		worldPos.x = (pos.x - (this.translateX * this.currentScale)) / this.currentScale;
		worldPos.y = (pos.y - (this.translateY * this.currentScale)) / this.currentScale;
		return worldPos;
	};

	updateViewPort = function() {
		this.viewPortDimensions = {
				w: this.canvas.width / this.currentScale,
				h: this.canvas.height / this.currentScale
		};
		
		this.topLeft = this.getWorldCoordinatesFromPixelCoordinates({x: 0, y: 0});
		this.bottomRight = this.getWorldCoordinatesFromPixelCoordinates({x: this.canvas.width, y: this.canvas.height});
	};

	drawBackgroundImages = function() {
		var i, imgConfig;
		for (i in this.backgroundImages) {
			imgConfig = this.backgroundImages[i];
			if (!imgConfig.img) {
				console.debug("image: " + i + " doesn't exist");
			}
			else {
				if (!imgConfig.disabled) {
					this.context.save();
					this.context.translate(imgConfig.x, imgConfig.y);
					if (imgConfig.scale) {
						this.context.scale(imgConfig.scale, imgConfig.scale);
					}
					this.context.drawImage(imgConfig.img, 0, 0);
					this.context.restore();
				}	
			}
			
		}
	};

	drawFixedImages = function() {
		var i, imgConfig;
		for (i in this.fixedImages) {
			imgConfig = this.fixedImages[i];
			if (!imgConfig.img) {
				console.debug("image: " + i + " doesn't exist");
			}
			else {
				if (!imgConfig.disabled) {
					this.context.translate(imgConfig.x, imgConfig.y);
					if (imgConfig.scale) {
						this.context.scale(imgConfig.scale, imgConfig.scale);
					}
					this.context.drawImage(imgConfig.img, 0, 0);
					this.context.restore();
				}	
			}
			
		}
	};

	drawWorld = function(world) {
		this.bodiesDrawn = {};
		this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.context.save();
		
		this.context.scale(this.currentScale, this.currentScale);
		this.context.translate(this.translateX, this.translateY);
		
		this.stepTransition();
		
		this.drawBackgroundImages();
		
		for (var b = world.m_bodyList; b; b = b.m_next) {
			if (!b.hidden) {
				for (var s = b.GetShapeList(); s != null; s = s.GetNext()) {
					try {
						this.drawShape(s, this.context, world);
					}
					catch (e) {
						console.debug(e);
					}
				}
			}
		}
		if (this.debugMode) {
			this.drawGrid(world);
		}
		
		this.context.restore();
		
		this.drawFixedImages();
		
		if (this.debugMode) {
			this.context.fillText(this.log, 50, 50);
		}
	};

	drawGrid = function(world) {
		this.context.strokeStyle = "#ff0000";
		this.context.beginPath();
		this.context.moveTo(0,0);
		this.context.lineTo(world.size.x, 0);
		this.context.lineTo(world.size.x, world.size.y);
		this.context.lineTo(0, world.size.y);
		this.context.lineTo(0, 0);
		
		this.context.stroke();
	};

	drawJoint = function(joint, world) {
		var b1 = joint.m_body1;
		var b2 = joint.m_body2;
		var x1 = b1.m_position;
		var x2 = b2.m_position;
		var p1 = joint.GetAnchor1();
		var p2 = joint.GetAnchor2();
		this.context.strokeStyle = '#00eeee';
		this.context.beginPath();
		switch (joint.m_type) {
		case planck.b2.Joint.e_distanceJoint:
			this.context.moveTo(p1.x, p1.y);
			this.context.lineTo(p2.x, p2.y);
			break;

		case planck.b2.Joint.e_pulleyJoint:
			// TODO
			break;

		default:
			if (b1 == world.m_groundBody) {
				this.context.moveTo(p1.x, p1.y);
				this.context.lineTo(x2.x, x2.y);
			}
			else if (b2 == world.m_groundBody) {
				this.context.moveTo(p1.x, p1.y);
				this.context.lineTo(x1.x, x1.y);
			}
			else {
				this.context.moveTo(x1.x, x1.y);
				this.context.lineTo(p1.x, p1.y);
				this.context.lineTo(x2.x, x2.y);
				this.context.lineTo(p2.x, p2.y);
			}
			break;
		}
		this.context.stroke();
	};

	drawImageForShape = function(shape) {
		var body = shape.GetBody();
		var image = this.images[body.svgId];
		if (image.img) {
			var imageEl = image.img;
			this.context.save();
			this.context.translate(body.GetCenterPosition().x, body.GetCenterPosition().y);
			if (image.scale) {
				this.context.scale(image.scale, image.scale);
			}
			this.context.rotate(body.GetRotation());
			this.context.drawImage(imageEl, -imageEl.width/2, -imageEl.height/2);
			
			if (this.effects[body.svgId]) {
				this.effects[body.svgId].draw(this.context);
			}
			this.context.restore();
		}
	};

	drawShape = function(shape) {
		var svgId = shape.GetBody().svgId;
		if (this.images[svgId]) {//only draw one image for bodies with more than one shape.
			if (!this.bodiesDrawn[svgId]) { 
				this.drawImageForShape(shape);
				this.bodiesDrawn[svgId] = true;
			}
		}
		else {
			this.context.strokeStyle = '#000000';
			this.context.fillStyle = '#000000';
			
			this.context.beginPath();
			switch (shape.m_type) {
			case planck.b2.Shape.e_circleShape:
				{
					var circle = shape;
					var pos = circle.m_position;
					var r = circle.m_radius;
					var segments = 16.0;
					var theta = 0.0;
					var dtheta = 2.0 * Math.PI / segments;
					// draw circle
					this.context.moveTo(pos.x + r, pos.y);
					for (var i = 0; i < segments; i++) {
						var d = new planck.b2.Vec2(r * Math.cos(theta), r * Math.sin(theta));
						var v = planck.b2.Math.AddVV(pos, d);
						this.context.lineTo(v.x, v.y);
						theta += dtheta;
					}
					this.context.lineTo(pos.x + r, pos.y);
			
					// draw radius
					this.context.moveTo(pos.x, pos.y);
					var ax = circle.m_R.col1;
					var pos2 = new planck.b2.Vec2(pos.x + r * ax.x, pos.y + r * ax.y);
					this.context.lineTo(pos2.x, pos2.y);
				}
				break;
			case planck.b2.Shape.e_polyShape:
				{
					var poly = shape;
					var tV = planck.b2.Math.AddVV(poly.m_position, planck.b2.Math.b2MulMV(poly.m_R, poly.m_vertices[0]));
					this.context.moveTo(tV.x, tV.y);
					for (var i = 0; i < poly.m_vertexCount; i++) {
						var v = planck.b2.Math.AddVV(poly.m_position, planck.b2.Math.b2MulMV(poly.m_R, poly.m_vertices[i]));
						this.context.lineTo(v.x, v.y);
					}
					this.context.lineTo(tV.x, tV.y);
				}
				break;
			}
			
			this.context.fill();
		}
	};
}
