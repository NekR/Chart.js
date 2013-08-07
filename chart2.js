(function() {
  var min = Math.min,
    max = Math.max,
    floor = Math.floor,
    round = Math.round,
    sin = Math.sin,
    cos = Math.cos;

  var calculateOffset = function(val, calculatedScale, scaleHop) {
    var outerValue = calculatedScale.steps * calculatedScale.stepValue,
      adjustedValue = val - calculatedScale.graphMin,
      scalingFactor = capValue(adjustedValue / outerValue, 1, 0);

    return (scaleHop * calculatedScale.steps) * scalingFactor;
  },
  capValue = function(valueToCap, maxValue, minValue) {
    if (isNumber(maxValue)) {
      if (valueToCap > maxValue) {
        return maxValue;
      }
    }

    if (isNumber(minValue)) {
      if (valueToCap < minValue) {
        return minValue;
      }
    }

    return valueToCap;
  },
  isNumber = function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },
  animationLoop = function(config, drawScale, drawData, chart) {
    var animFrameAmount = (config.animation) ?
        1 / capValue(config.animationSteps, Number.MAX_VALUE, 1) : 1,
      easingFunction = animationOptions[config.animationEasing],
      percentAnimComplete = config.animation ? 0 : 1;
    
    if (typeof drawScale !== 'function') drawScale = function() {};

    var animateFrame = function() {
      var easeAdjustedAnimationPercent = config.animation ?
        capValue(easingFunction(percentAnimComplete), null, 0) : 1;

      clear(chart.context, chart.width, chart.height);

      if (config.scaleOverlay) {
        drawData(easeAdjustedAnimationPercent);
        drawScale();
      } else {
        drawScale();
        drawData(easeAdjustedAnimationPercent);
      }
    },
    animLoop = function() {
      // We need to check if the animation is incomplete (less than 1), or complete (1).
      percentAnimComplete += animFrameAmount;
      animateFrame(); 

      // Stop the loop continuing forever
      if (percentAnimComplete <= 1) {
        requestAnimationFrame(animLoop);
      } else {
        if (typeof config.onAnimationComplete === 'function') {
          config.onAnimationComplete();
        }
      }
    };
    
    requestAnimationFrame(animLoop);
  },
  calculateScale = function(
    drawingHeight,
    maxSteps,
    minSteps,
    maxValue,
    minValue,
    labelTemplateString
  ) {
    var graphMin,
      graphMax,
      graphRange,
      stepValue,
      numberOfSteps,
      valueRange,
      rangeOrderOfMagnitude,
      decimalNum;

    var calculateOrderOfMagnitude = function(val) {
      return floor(Math.log(val) / Math.LN10);
    };
    
    valueRange = maxValue - minValue;
    
    rangeOrderOfMagnitude = calculateOrderOfMagnitude(valueRange);
    graphMin = floor(minValue / (1 * Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude);
    graphMax = Math.ceil(maxValue / (1 * Math.pow(10, rangeOrderOfMagnitude))) * Math.pow(10, rangeOrderOfMagnitude);
    graphRange = graphMax - graphMin;
    stepValue = Math.pow(10, rangeOrderOfMagnitude);
    numberOfSteps = round(graphRange / stepValue);

    // Compare number of steps to the max and min for that size graph,
    // and add in half steps if need be.

    while (numberOfSteps < minSteps || numberOfSteps > maxSteps) {
      if (numberOfSteps < minSteps) {
        stepValue /= 2;
        numberOfSteps = round(graphRange / stepValue);
      } else {
        stepValue *= 2;
        numberOfSteps = round(graphRange / stepValue);
      }
    }

    var labels = [];

    populateLabels(labelTemplateString, labels, numberOfSteps, graphMin, stepValue);
  
    return {
      steps: numberOfSteps,
      stepValue: stepValue,
      graphMin: graphMin,
      labels: labels
    };
  },
  // Populate an array of all the labels by interpolating the string.
  populateLabels = function(labelTemplateString, labels, numberOfSteps, graphMin, stepValue) {
    if (labelTemplateString) {
      // Fix floating point errors by setting to fixed the on the same decimal as the stepValue.
      for (var i = 1; i < numberOfSteps + 1; i++) {
        labels.push(
          tmpl(labelTemplateString, {
            value: (graphMin + (stepValue * i))
              .toFixed(getDecimalPlaces(stepValue))
          })
        );
      }
    }
  },
  // Default if undefined
  Default = function(userDeclared, valueIfFalse) {
    if (!userDeclared) {
      return valueIfFalse;
    } else {
      return userDeclared;
    }
  },
  getDecimalPlaces = function(num) {
    var numberOfDecimalPlaces;

    if (num % 1 != 0) {
      return (num + '').split('.', 2)[1].length;
    } else {
      return 0;
    }
  },
  mergeChartConfig = function(defaults, userDefined) {
    var returnObj = {};

    for (var attrname in defaults) {
      returnObj[attrname] = defaults[attrname];
    }

    for (var attrname in userDefined) {
      returnObj[attrname] = userDefined[attrname];
    }

    return returnObj;
  },
  clear = function(gl, width, height) {
    gl.clearRect(0, 0, width, height);
  };

  // Easing functions adapted from Robert Penner's easing equations
  // http://www.robertpenner.com/easing/

  var animationOptions = {
    linear: function(t) {
      return t;
    },
    easeInQuad: function(t) {
      return t * t;
    },
    easeOutQuad: function(t) {
      return -1 * t * (t - 2);
    },
    easeInOutQuad: function(t) {
      if ((t /= 1 / 2) < 1) {
        return 1/2*t*t;
      }

      return -1 / 2 * (--t * (t - 2) - 1);
    },
    easeInCubic: function(t) {
      return t * t * t;
    },
    easeOutCubic: function(t) {
      return 1 * ((t = t / 1 - 1) * t * t + 1);
    },
    easeInOutCubic: function(t) {
      if ((t /= 1 / 2) < 1) {
        return 1 / 2 * t * t * t;
      }

      return 1 / 2 * ((t -= 2) * t * t + 2);
    },
    easeInQuart: function(t) {
      return t * t * t * t;
    },
    easeOutQuart: function(t) {
      return -1 * ((t = t / 1 - 1) * t * t * t - 1);
    },
    easeInOutQuart: function(t) {
      if ((t /= 1 / 2) < 1) {
        return 1 / 2 * t * t * t * t;
      }

      return -1 / 2 * ((t -= 2) * t * t * t - 2);
    },
    easeInQuint: function(t) {
      return 1 * (t /= 1) * t * t * t * t;
    },
    easeOutQuint: function(t) {
      return 1 * ((t = t / 1 - 1) * t * t * t * t + 1);
    },
    easeInOutQuint: function(t) {
      if ((t /= 1 / 2) < 1) {
        return 1 / 2 * t * t * t * t * t;
      }

      return 1 / 2 * ((t -= 2) * t * t * t * t + 2);
    },
    easeInSine: function(t) {
      return -1 * cos(t / 1 * (Math.PI / 2)) + 1;
    },
    easeOutSine: function(t) {
      return 1 * sin(t / 1 * (Math.PI / 2));
    },
    easeInOutSine: function(t) {
      return -1 / 2 * (cos(Math.PI * t / 1) - 1);
    },
    easeInExpo: function(t) {
      return (t === 0) ? 1 : 1 * Math.pow(2, 10 * (t / 1 - 1));
    },
    easeOutExpo: function(t) {
      return (t === 1) ? 1 : 1 * (-Math.pow(2, -10 * t / 1) + 1);
    },
    easeInOutExpo: function(t) {
      if (!t || t === 1) return t;

      if ((t /= 1 / 2) < 1) {
        return 1 / 2 * Math.pow(2, 10 * (t - 1));
      }

      return 1 / 2 * (-Math.pow(2, -10 * --t) + 2);
    },
    easeInCirc: function(t) {
      if (t >= 1) return t;
      return -1 * (Math.sqrt(1 - (t /= 1) * t) - 1);
    },
    easeOutCirc: function(t) {
      return 1 * Math.sqrt(1 - (t = t / 1 - 1) * t);
    },
    easeInOutCirc: function(t) {
      if ((t /= 1 / 2) < 1) {
        return -1 / 2 * (Math.sqrt(1 - t * t) - 1);
      }

      return 1 / 2 * Math.sqrt(1 - (t -= 2) * t) + 1;
    },
    easeInElastic: function(t) {
      var s = 1.70158;
      var p;
      var a = 1;

      if (!t || t === 1) return t;
      p = 1 * 0.3;

      /*if (a < 1) {
        a = 1;
        s = p / 4;
      } else {*/
        s = p / (2 * Math.PI) * Math.asin(1 / a);
      //}

      return -(a * Math.pow(2, 10 * (t -= 1)) *
        sin((t * 1 - s) * (2 * Math.PI) / p));
    },
    easeOutElastic: function (t) {
      var s = 1.70158;
      var p;
      var a = 1;

      if (!t || t === 1) return t;
      p = 1 * 0.3;


      /*if (a < 1) {
        a = 1;
        s = p / 4;
      } else {*/
        s = p / (2 * Math.PI) * Math.asin(1 / a);
      //}

      return a * Math.pow(2, -10 * t) *
        sin((t * 1 - s) * (2 * Math.PI) / p) + 1;
    },
    easeInOutElastic: function (t) {
      var s=1.70158;var p=0;var a=1;
      if (t==0) return 0;  if ((t/=1/2)==2) return 1;  if (!p) p=1*(.3*1.5);
      if (a < Math.abs(1)) { a=1; var s=p/4; }
      else var s = p/(2*Math.PI) * Math.asin (1/a);
      if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*1-s)*(2*Math.PI)/p ));
      return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*1-s)*(2*Math.PI)/p )*.5 + 1;
    },
    easeInBack: function (t) {
      var s = 1.70158;
      return 1*(t/=1)*t*((s+1)*t - s);
    },
    easeOutBack: function (t) {
      var s = 1.70158;
      return 1*((t=t/1-1)*t*((s+1)*t + s) + 1);
    },
    easeInOutBack: function (t) {
      var s = 1.70158; 
      if ((t/=1/2) < 1) return 1/2*(t*t*(((s*=(1.525))+1)*t - s));
      return 1/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2);
    },
    easeInBounce: function (t) {
      return 1 - animationOptions.easeOutBounce (1-t);
    },
    easeOutBounce: function (t) {
      if ((t/=1) < (1/2.75)) {
        return 1*(7.5625*t*t);
      } else if (t < (2/2.75)) {
        return 1*(7.5625*(t-=(1.5/2.75))*t + .75);
      } else if (t < (2.5/2.75)) {
        return 1*(7.5625*(t-=(2.25/2.75))*t + .9375);
      } else {
        return 1*(7.5625*(t-=(2.625/2.75))*t + .984375);
      }
    },
    easeInOutBounce: function (t) {
      if (t < 1/2) return animationOptions.easeInBounce (t*2) * .5;
      return animationOptions.easeOutBounce (t*2-1) * .5 + 1*.5;
    }
  },
  charts = {};

  var Chart = function(canvas) {
    var chart = this,
      self = this,
      context = canvas.getContext('2d'),
      width = canvas.width,
      height = canvas.height,
      ratio;

    this.context = context;
    this.canvas = canvas;
    this.width = width;
    this.height = height;

    var deviceRatio = window.devicePixelRatio || 1,
      backingStoreRatio = context.webkitBackingStorePixelRatio ||
        context.mozBackingStorePixelRatio ||
        context.msBackingStorePixelRatio ||
        context.oBackingStorePixelRatio ||
        context.backingStorePixelRatio || 1;

    if (devicePixelRatio !== backingStoreRatio) {
      ratio = devicePixelRatio / backingStoreRatio;

      canvas.width = width * ratio;
      canvas.height = height * ratio;

      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';

      context.scale(ratio, ratio);
    }
  };

  var defaults = {
    line: {
      scaleOverlay : false,
      scaleOverride : false,
      scaleSteps : null,
      scaleStepWidth : null,
      scaleStartValue : null,
      scaleLineColor : "rgba(0,0,0,.1)",
      scaleLineWidth : 1,
      scaleShowLabels : true,
      scaleLabel : "<%=value%>",
      scaleFontFamily : "'Arial'",
      scaleFontSize : 12,
      scaleFontStyle : "normal",
      scaleFontColor : "#666",
      scaleShowGridLines : true,
      scaleGridLineColor : "rgba(0,0,0,.05)",
      scaleGridLineWidth : 1,
      bezierCurve : true,
      pointDot : true,
      pointDotRadius : 4,
      pointDotStrokeWidth : 2,
      datasetStroke : true,
      datasetStrokeWidth : 2,
      datasetFill : true,
      animation : true,
      animationSteps : 60,
      animationEasing : "easeOutQuart",
      onAnimationComplete : null
    }
  };

  Chart.prototype = {
    create: function(type, data, options) {
      type = type.toLowerCase();

      options = mergeChartConfig(defaults[type], options);
      type = new charts[type](data, options, this);
      return type;
    }
  };

  var Line = charts.line = function(data, config, chart) {
    var maxSize,
      scaleHop,
      calculatedScale,
      labelHeight,
      scaleHeight,
      valueBounds,
      labelTemplateString,
      valueHop,
      widestXLabel,
      xAxisLength,
      yAxisPosX,
      xAxisPosY,
      rotateLabels = 0,
      gl = chart.context,
      width = chart.width,
      height = chart.height;

    var drawLines = function(animPc) {
      var i = 0,
        datasets = data.datasets,
        len = datasets.length,
        item,
        itemData,
        itemLen;

      var yPos = function(iteration) {
        return xAxisPosY - animPc * calculateOffset(itemData[iteration], calculatedScale, scaleHop);
      },
      xPos = function(iteration) {
        return yAxisPosX + (valueHop * iteration);
      };

      for (; i < len; i++) {
        item = datasets[i];
        itemData = item.data;
        itemLen = itemData.length;

        gl.strokeStyle = item.strokeColor;
        gl.lineWidth = config.datasetStrokeWidth;
        gl.beginPath();
        gl.moveTo(
          yAxisPosX,
          xAxisPosY - animPc *
            calculateOffset(itemData[0], calculatedScale, scaleHop)
        );

        var j = 1;

        for (; j < itemLen; j++) {
          if (config.bezierCurve) {
            gl.bezierCurveTo(
              xPos(j - 0.5),
              yPos(j - 1),
              xPos(j - 0.5),
              yPos(j),
              xPos(j),
              yPos(j)
            );
          } else {
            gl.lineTo(xPos(j), yPos(i,j));
          }
        }

        gl.stroke();

        if (config.datasetFill) {
          gl.lineTo(yAxisPosX + valueHop * (itemLen - 1), xAxisPosY);
          gl.lineTo(yAxisPosX, xAxisPosY);

          gl.closePath();
          gl.fillStyle = item.fillColor;
          gl.fill();
        } else {
          gl.closePath();
        }

        if (config.pointDot) {
          gl.fillStyle = item.pointColor;
          gl.strokeStyle = item.pointStrokeColor;
          gl.lineWidth = config.pointDotStrokeWidth;

          var k = 0;

          for (; k < itemLen; k++) {
            gl.beginPath();
            gl.arc(
              yAxisPosX + (valueHop * k),
              xAxisPosY - animPc * calculateOffset(itemData[k], calculatedScale, scaleHop),
              config.pointDotRadius,
              0,
              Math.PI * 2,
              true
            );

            gl.fill();
            gl.stroke();
          }
        }
      }
    },
    drawScale = function() {
      // X axis line
      gl.lineWidth = config.scaleLineWidth;
      gl.strokeStyle = config.scaleLineColor;
      gl.beginPath();
      gl.moveTo(width - widestXLabel / 2 + 5, xAxisPosY);
      gl.lineTo(width - widestXLabel / 2 - xAxisLength - 5, xAxisPosY);
      gl.stroke();
      
      if (rotateLabels > 0) {
        gl.save();
        gl.textAlign = 'right';
      } else {
        gl.textAlign = 'center';
      }

      gl.fillStyle = config.scaleFontColor;

      var i = 0,
        labels = data.labels,
        labelsLen = labels.length;

      for (; i < labelsLen; i++) {
        gl.save();

        if (rotateLabels > 0) {
          gl.translate(
            yAxisPosX + i * valueHop,
            xAxisPosY + config.scaleFontSize
          );

          gl.rotate(-rotateLabels * (Math.PI / 180));
          gl.fillText(labels[i], 0, 0);
          gl.restore();
        } else {
          gl.fillText(
            labels[i],
            yAxisPosX + i * valueHop,
            xAxisPosY + config.scaleFontSize + 3
          );
        }

        gl.beginPath();
        gl.moveTo(yAxisPosX + i * valueHop, xAxisPosY + 3);
        
        //Check i isnt 0, so we dont go over the Y axis twice.
        if (config.scaleShowGridLines && i > 0) {
          gl.lineWidth = config.scaleGridLineWidth;
          gl.strokeStyle = config.scaleGridLineColor;
          gl.lineTo(yAxisPosX + i * valueHop, 5);
        } else {
          gl.lineTo(yAxisPosX + i * valueHop, xAxisPosY + 3);
        }

        gl.stroke();
      }
      
      //Y axis
      gl.lineWidth = config.scaleLineWidth;
      gl.strokeStyle = config.scaleLineColor;
      gl.beginPath();
      gl.moveTo(yAxisPosX, xAxisPosY + 5);
      gl.lineTo(yAxisPosX, 5);
      gl.stroke();
      
      gl.textAlign = 'right';
      gl.textBaseline = 'middle';

      var j = 0,
        steps = calculatedScale.steps;

      for (; j < steps; j++) {
        gl.beginPath();
        gl.moveTo(yAxisPosX - 3, xAxisPosY - (j + 1) * scaleHop);

        if (config.scaleShowGridLines) {
          gl.lineWidth = config.scaleGridLineWidth;
          gl.strokeStyle = config.scaleGridLineColor;
          gl.lineTo(yAxisPosX + xAxisLength + 5, xAxisPosY - (j + 1) * scaleHop);
        } else {
          gl.lineTo(yAxisPosX - 0.5, xAxisPosY - (j + 1) * scaleHop);
        }
        
        gl.stroke();
        
        if (config.scaleShowLabels) {
          gl.fillText(calculatedScale.labels[j], yAxisPosX - 8, xAxisPosY - (j + 1) * scaleHop);
        }
      }
    },
    calculateXAxisSize = function() {
      var longestText = 1;

      // if we are showing the labels
      if (config.scaleShowLabels) {
        gl.font = config.scaleFontStyle + ' ' +
          config.scaleFontSize + 'px ' + config.scaleFontFamily;

        var i = 0,
          labels = calculatedScale.labels,
          len = labels.length
          measuredText;

        for (; i < len; i++) {
          var measuredText = gl.measureText(labels[i]).width;

          longestText = (measuredText > longestText) ?
            measuredText : longestText;
        }

        // Add a little extra padding from the y axis
        longestText += 10;
      }

      xAxisLength = width - longestText - widestXLabel;
      valueHop = floor(xAxisLength / (data.labels.length - 1));
        
      yAxisPosX = width - widestXLabel / 2 - xAxisLength;
      xAxisPosY = scaleHeight + config.scaleFontSize / 2;
    },
    calculateDrawingSizes = function() {
      maxSize = height;

      // Need to check the X axis first - measure the length of each text metric,
      // and figure out if we need to rotate by 45 degrees.
      gl.font = config.scaleFontStyle + ' ' +
        config.scaleFontSize + 'px ' + config.scaleFontFamily;

      widestXLabel = 1;

      var i = 0,
        labels = data.labels,
        len = labels.length;

      for (; i < len; i++){
        var textLength = gl.measureText(labels[i]).width;

        // If the text length is longer - make that equal to longest text!
        widestXLabel = (textLength > widestXLabel) ? textLength : widestXLabel;
      }

      if (width / len < widestXLabel) {
        rotateLabels = 45;

        if (width / len < cos(rotateLabels) * widestXLabel) {
          rotateLabels = 90;
          maxSize -= widestXLabel; 
        } else {
          maxSize -= sin(rotateLabels) * widestXLabel;
        }
      } else {
        maxSize -= config.scaleFontSize;
      }

      // Add a little padding between the x line and the text
      maxSize -= 5;
      labelHeight = config.scaleFontSize;
      
      maxSize -= labelHeight;

      // Set 5 pixels greater than the font size to allow for a little padding from the X axis.
      // Then get the area above we can safely draw on.
      scaleHeight = maxSize;
    },
    getValueBounds = function() {
      var upperValue = Number.MIN_VALUE,
        lowerValue = Number.MAX_VALUE,
        i = 0,
        datasets = data.datasets,
        len = datasets.length,
        j = 0,
        item,
        itemData,
        itemLen,
        deepItem;

      for (; i < len; i++) {
        item = datasets[i];
        itemData = item.data;
        itemLen = itemData.length;

        for (; j < itemLen; j++) {
          deepItem = itemData[j];

          if (deepItem > upperValue) {
            upperValue = deepItem;
          }

          if (deepItem < lowerValue) {
            lowerValue = deepItem;
          }
        }
      }
    
      var maxSteps = floor(scaleHeight / (labelHeight * 0.66)),
        minSteps = Math.floor(scaleHeight / labelHeight * 0.5);
      
      return {
        maxValue: upperValue,
        minValue: lowerValue,
        maxSteps: maxSteps,
        minSteps: minSteps
      };
    };

    calculateDrawingSizes();
    valueBounds = getValueBounds();

    // Check and set the scale
    labelTemplateString = (config.scaleShowLabels)? config.scaleLabel : '';

    if (!config.scaleOverride) {
      calculatedScale = calculateScale(
        scaleHeight,
        valueBounds.maxSteps,
        valueBounds.minSteps,
        valueBounds.maxValue,
        valueBounds.minValue,
        labelTemplateString
      );
    } else {
      calculatedScale = {
        steps: config.scaleSteps,
        stepValue: config.scaleStepWidth,
        graphMin: config.scaleStartValue,
        labels: []
      }

      populateLabels(
        labelTemplateString,
        calculatedScale.labels,
        calculatedScale.steps,
        config.scaleStartValue,
        config.scaleStepWidth
      );
    }
    
    scaleHop = floor(scaleHeight / calculatedScale.steps);
    calculateXAxisSize();
    animationLoop(config, drawScale, drawLines, chart);
  };

  window.Chart = Chart;


  //Javascript micro templating by John Resig - source at http://ejohn.org/blog/javascript-micro-templating/
  var cache = {};
  
  function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.
    var fn = !/\W/.test(str) ?
      cache[str] = cache[str] ||
        tmpl(document.getElementById(str).innerHTML) :
     
      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
      new Function("obj",
        "var p=[],print=function(){p.push.apply(p,arguments);};" +
       
        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +
       
        // Convert the template into pure JavaScript
        str
          .replace(/[\r\t\n]/g, " ")
          .split("<%").join("\t")
          .replace(/((^|%>)[^\t]*)'/g, "$1\r")
          .replace(/\t=(.*?)%>/g, "',$1,'")
          .split("\t").join("');")
          .split("%>").join("p.push('")
          .split("\r").join("\\'")
      + "');}return p.join('');");
   
    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };
}());