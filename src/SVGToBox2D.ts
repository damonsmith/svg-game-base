import * as planck from "planck-js"

interface PathOptions {
	fixed: boolean
	density: number
	hidden: boolean
	viewBox?: boolean
}

/**
 * Converts an SVG element into a Box2D World definition, using the element 
 * description to generate joints, welds, ropes and mouse points.
 * 
 * @returns {SVGToBox2D}
 */
export class SVGToBox2D {
	
	convertSVGToWorldData(svg: SVGElement) {
		var bodyMap = {};
		var shapeMap = {};
		var jointMap = {};
		var viewBoxes = {};
		var width = parseInt(svg.getAttribute("width") || "0");
		var height = parseInt(svg.getAttribute("height") || "0");
		var size = {x: width, y: height};
	
		var worldAABB = new planck.AABB();
		worldAABB.minVertex.Set(-size.x*3, -size.y*3);
		worldAABB.maxVertex.Set(size.x*4, size.y*4);
		var gravity = new planck.Vec2(0, 300);
		var doSleep = true;
		var world = new planck.World(worldAABB, gravity, doSleep);
		world.size = size;
		var groups = Array.prototype.slice.call(svg.getElementsByTagName("g"));
		var paths = Array.prototype.slice.call(document.getElementsByTagName("path"));
		var rects = Array.prototype.slice.call(document.getElementsByTagName("rect"));
		var images = Array.prototype.slice.call(document.getElementsByTagName("image"));
		
		this.createBodiesFromGroups(world, groups, bodyMap, shapeMap);
		this.createShapes(world, paths, bodyMap, shapeMap);
		this.createBoxes(world, rects, bodyMap, shapeMap, viewBoxes);
		this.createRevoluteJoints(world, paths, bodyMap, jointMap);
		this.createDistanceJoints(world, paths, bodyMap, jointMap);
		this.createWelds(world, paths, bodyMap, jointMap);
		
		return {world: world, bodyMap: bodyMap, shapeMap: shapeMap, jointMap: jointMap, size: size, viewBoxes: viewBoxes};
	}

	createBox(world, x, y, width, height, fixed) {
		if (typeof(fixed) == 'undefined') fixed = true;
		var boxSd = new planck.BoxDef();
		if (!fixed) boxSd.density = 1.0;
		boxSd.extents.Set(width, height);
		var boxBd = new planck.BodyDef();
		boxBd.AddShape(boxSd);
		boxBd.position.Set(x,y);
		return world.CreateBody(boxBd);
	}

	getTypedPathSeg(seg: SVGPathSeg) {
		switch (seg.pathSegType) {
			case SVGPathSeg.PATHSEG_ARC_ABS: return seg as SVGPathSegArcAbs
			case SVGPathSeg.PATHSEG_ARC_REL: return seg as SVGPathSegArcRel
			case SVGPathSeg.PATHSEG_CLOSEPATH: return seg as SVGPathSegClosePath
			case SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS: return seg as SVGPathSegCurvetoCubicAbs
			case SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL: return seg as SVGPathSegCurvetoCubicRel
			case SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS: return seg as SVGPathSegCurvetoCubicSmoothAbs
			case SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL: return seg as SVGPathSegCurvetoCubicSmoothRel
			case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS: return seg as SVGPathSegCurvetoQuadraticAbs
			case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL: return seg as SVGPathSegCurvetoQuadraticRel
			case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS: return seg as SVGPathSegCurvetoQuadraticSmoothAbs
			case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL: return seg as SVGPathSegCurvetoQuadraticSmoothRel
			case SVGPathSeg.PATHSEG_LINETO_ABS: return seg as SVGPathSegLinetoAbs
			case SVGPathSeg.PATHSEG_LINETO_REL: return seg as SVGPathSegLinetoRel
			case SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS: return seg as SVGPathSegLinetoHorizontalAbs
			case SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL: return seg as SVGPathSegLinetoHorizontalRel
			case SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS: return seg as SVGPathSegLinetoVerticalAbs
			case SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL: return seg as SVGPathSegLinetoVerticalRel
			case SVGPathSeg.PATHSEG_MOVETO_ABS: return seg as SVGPathSegMovetoAbs
			case SVGPathSeg.PATHSEG_MOVETO_REL: return seg as SVGPathSegMovetoRel
			default: return seg as SVGPathSeg
		}
	}

	isRelPathSeg(seg: SVGPathSeg) {
		return seg.pathSegType === 
			SVGPathSeg.PATHSEG_ARC_REL ||
			SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL ||
			SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL ||
			SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL || 
			SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL || 
			SVGPathSeg.PATHSEG_LINETO_REL || 
			SVGPathSeg.PATHSEG_MOVETO_REL
	}

	isAbsPathSeg(seg: SVGPathSeg) {
		return seg.pathSegType === 
			SVGPathSeg.PATHSEG_ARC_ABS ||
			SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS ||
			SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS ||
			SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS || 
			SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS || 
			SVGPathSeg.PATHSEG_LINETO_ABS || 
			SVGPathSeg.PATHSEG_MOVETO_ABS
	}

	convertPathToShape(path: SVGPathElement, options) {

		var i, pathSegElement: any, polyShape = new planck.PolyDef();
		let typedPathSeg: SVGPathSegMovetoRel | SVGPathSegLinetoRel | SVGPathSegCurvetoCubicRel
		if (!options.fixed) polyShape.density = options.density;
		
		var previousPoint = [0,0];
		let point:number[]
		var points: number[][] = [];
		
		for (i=0; i<path.pathSegList.numberOfItems; i++) {
			pathSegElement = this.getTypedPathSeg(path.pathSegList.getItem(i))
			
			if (this.isRelPathSeg(pathSegElement)) {
				point = [previousPoint[0] + pathSegElement.x, previousPoint[1] + pathSegElement.y];
				previousPoint = point;
				points.push(point);
			}
			else if (this.isAbsPathSeg(pathSegElement)) {
				point = [pathSegElement.x, pathSegElement.y];
				previousPoint = point;
				points.push(point);
			}
		}
		
		polyShape.vertexCount = points.length;
		for (i = 0; i < points.length; i++) {
			polyShape.vertices[i].Set(points[i][0], points[i][1]);
		}
		polyShape.svgId = path.id;
		return polyShape;
	};

	convertRectToBox(rect, options) {

		var boxSd = new planck.BoxDef();
		if (!options.fixed) {
			boxSd.density = 1.0;
		}
		boxSd.extents.Set((rect.getAttribute("width")*1)/2, (rect.getAttribute("height")*1)/2); 
		
		boxSd.localPosition.Set(
				(rect.getAttribute("x")*1) + (boxSd.extents.x),
				(rect.getAttribute("y")*1) + (boxSd.extents.y)
		);
		
		boxSd.svgId = rect.id;
		boxSd.hidden = options.hidden;
		return boxSd;
	}

	createBall(world, x, y, rad, fixed) {
		var ballSd = new planck.CircleDef();
		if (!fixed) ballSd.density = 1.0;
		ballSd.radius = rad || 10;
		ballSd.restitution = 0.2;
		var ballBd = new planck.BodyDef();
		ballBd.AddShape(ballSd);
		ballBd.position.Set(x,y);
		return world.CreateBody(ballBd);
	};


	createBodiesFromGroups(world, groups, bodyMap, shapeMap) {
		var i;
		for (i=0; i<groups.length; i++) {
			this.createBodyFromGroup(world, groups[i], bodyMap, shapeMap);
		}
	};

	createBodyFromGroup(world, group, bodyMap, shapeMap) {
		let i:number
		let options:PathOptions = {
			fixed: false,
			density: 1.0,
			hidden: false
		}
		var path:SVGPathElement, paths = group.getElementsByTagName("path");
		var rect, rects = group.getElementsByTagName("rect");
		
		var translate = this.getTranslate(group);
		
		var bodyDef = new planck.BodyDef();
		bodyDef.position.Set(translate.x,translate.y);
		
		for (i=0; i<paths.length; i++) {
			path = paths[i];
			if (!shapeMap[path.id]) {
				options = this.getOptionsByParsingDescription(path);
				var polyShape = this.convertPathToShape(path, options);
				bodyDef.AddShape(polyShape);
				shapeMap[path.id] = polyShape;
			}
		}
		for (i=0; i<rects.length; i++) {
			rect = rects[i];
			if (!shapeMap[rect.id]) {
				options = this.getOptionsByParsingDescription(rect);
				var box = this.convertRectToBox(rect, options);
				bodyDef.AddShape(box);
				shapeMap[rect.id] = box;
			}
		}

		var body = world.CreateBody(bodyDef);
		body.svgId = group.id;
		body.hidden = options.hidden;
		bodyMap[body.svgId] = body;
	};

	createShapes(world, paths, bodyMap, shapeMap) {
		var self = this;
		paths.forEach(function(pathElement) {

			if (!shapeMap[pathElement.id] &&
				pathElement.id.indexOf("-joint") === -1 &&
				pathElement.id.indexOf("-rope")  === -1 &&
				pathElement.id.indexOf("-weld")  === -1 &&
				pathElement.id.indexOf("-mouse") === -1) { 
				
				var options = self.getOptionsByParsingDescription(pathElement);
				var polyShape = self.convertPathToShape(pathElement, options);
				var bodyDef = new planck.BodyDef();
				
				bodyDef.AddShape(polyShape);
				bodyDef.position.Set(0,0);
				var body = world.CreateBody(bodyDef);
				body.hidden = options.hidden;
				body.svgId = pathElement.id;
				shapeMap[body.svgId] = polyShape;
				polyShape.hidden = options.hidden;
				bodyMap[body.svgId] = body;
			}
		});
	};

	createBoxes(world, rects, bodyMap, shapeMap, viewBoxes) {
		var self = this;
		rects.forEach(function(rectElement) {

			if (!shapeMap[rectElement.id]) {
				
				var options = self.getOptionsByParsingDescription(rectElement);
				//If it's set to be a viewbox then don't create a Box2D body out of it, just
				//record it's dimensions in viewBoxes with the id as the name.
				if (options.viewBox) {
					viewBoxes[rectElement.id] = {
						x: rectElement.getAttribute("x")*1,
						y: rectElement.getAttribute("y")*1,
						width: rectElement.getAttribute("width")*1, 
						height: rectElement.getAttribute("height")*1
					}
				}
				else {
					var box = self.convertRectToBox(rectElement, options);
					var bodyDef = new planck.BodyDef();
					
					bodyDef.AddShape(box);
					var body = world.CreateBody(bodyDef);
					body.hidden = options.hidden;
					body.svgId = rectElement.id;
					shapeMap[body.svgId] = box;
					bodyMap[body.svgId] = body;	
				}
			}
		});
	};

	createRevoluteJoints(world, paths, bodyMap, jointMap) {
		var self = this;
		
		paths.forEach(function(pathElement) {
			if (pathElement.id.indexOf("-joint") !== -1) {
				var translate = self.getTranslate(pathElement);
				
				var jointDef = new planck.RevoluteJointDef();
				self.assignBodiesFromId(pathElement.id, jointDef, world, bodyMap);
				
				//console.debug("creating revolute joint between: " + jointDef.body1.svgId + " and " + jointDef.body2.svgId);
				jointDef.anchorPoint = new planck.Vec2(pathElement.pathSegList.getItem(0).x + translate.x, pathElement.pathSegList.getItem(0).y + translate.y);
				var joint = world.CreateJoint(jointDef);
				joint.svgId = pathElement.id;
				jointMap[joint.svgId] = joint;
			}
		});
	};

	createWelds(world, paths, bodyMap, jointMap) {
		var self = this;
		
		paths.forEach(function(pathElement) {
			if (pathElement.id.indexOf("-weld") !== -1) {
				var translate = self.getTranslate(pathElement);
				
				var jointDef = new planck.RevoluteJointDef();
				jointDef.enableLimit = true;
				self.assignBodiesFromId(pathElement.id, jointDef, world, bodyMap);
				
				//console.debug("creating revolute joint between: " + jointDef.body1.svgId + " and " + jointDef.body2.svgId);
				jointDef.anchorPoint = new planck.Vec2(pathElement.pathSegList.getItem(0).x + translate.x, pathElement.pathSegList.getItem(0).y + translate.y);
				var joint = world.CreateJoint(jointDef);
				joint.svgId = pathElement.id;
				jointMap[joint.svgId] = joint;
			}
		});
	};


	createDistanceJoints(world, paths, bodyMap, jointMap) {
		var self = this;
		paths.forEach(function(pathElement) {
			var translate = self.getTranslate(pathElement);
			let point: number[]
			var pointList:number[][] = [];
			var previousPoint = [0,0];
			
			
			if (pathElement.id.indexOf("-rope") !== -1) {
				
				var i;
				for (i=0; i<pathElement.pathSegList.numberOfItems; i++) {
					var pathSegElement = pathElement.pathSegList.getItem(i);
					if (pathSegElement.pathSegType !== 1) {
						point = [previousPoint[0] + pathSegElement.x + translate.x, previousPoint[1] + pathSegElement.y + translate.y];
						previousPoint = point;
						pointList.push(point);
					}
				}
				
				var distJoint = new planck.DistanceJointDef();
				self.assignBodiesFromId(pathElement.id, distJoint, world, bodyMap);

				distJoint.anchorPoint1 = new planck.Vec2(pointList[0][0], pointList[0][1]);
				distJoint.anchorPoint2 = new planck.Vec2(pointList[1][0], pointList[1][1]);
				var distJointOut = world.CreateJoint(distJoint);
				distJointOut.svgId = pathElement.id;
				jointMap[distJoint.svgId] = distJointOut;
			}
		});
	};

	assignBodiesFromId(idString, joint, world, bodyMap) {
	
		var pathSegs = idString.split("-");
		
		joint.body1 = bodyMap[pathSegs[0]];
		if (!joint.body1) {
			throw "Error 110: joint id is trying to join something that doesn't exist: " + pathSegs[0];
		}
		
		if (pathSegs.length === 3) {
			
			joint.body2 = bodyMap[pathSegs[1]];
			if (!joint.body2) {
				throw "Error 110: joint id is trying to join something that doesn't exist: " + pathSegs[1];
			}
		}
		else if (pathSegs.length === 2) {
			joint.body2 = world.GetGroundBody();
		}
		else {
			throw "Error 111 (invalid number of hyphens in an id for a joint item)";
		}
	};

	getTranslate(path) {
		var translate = {x: 0, y: 0};
		
		var transform = path.getAttribute("transform");
		if (transform && transform.indexOf("translate(") != -1) {
			var translateVals = transform.match("translate\\(([\\-?\\d\\.]+)[,\\ ]+([\\-?\\d\\.]+)");
			translate.x = translateVals[1]*1;
			translate.y = translateVals[2]*1;
		}
		return translate;
	};

	getOptionsByParsingDescription(pathElement): PathOptions {
	
		var userOptions = {};
		
		try {
			if (pathElement.getElementsByTagName("desc")[0]) {
				//console.debug("{" + pathElement.getElementsByTagName("desc")[0].childNodes[0].textContent + "}");
				userOptions = JSON.parse("{" + pathElement.getElementsByTagName("desc")[0].childNodes[0].textContent + "}");
			}	
		}
		catch (e) {
			console.error(e);	
			console.error(
					'the PathElement "' + pathElement.id + 
					'" has a description which cant be parsed as JSON.\n' + 
					'descriptions are used to add options like density or friction to objects in JSON format.');
		}

		var defaultOptions = {
				fixed: false,
				density: 1.0,
				hidden: false
		};
		
		return Object.assign({}, defaultOptions, userOptions);
	}
}