(function() {
  'use strict';

  var min = Math.min,
    max = Math.max,
    floor = Math.floor,
    round = Math.round,
    sin = Math.sin,
    cos = Math.cos,
    ceil = Math.ceil,
    pow = Math.pow,
    abs = Math.abs,
    isArray = Array.isArray;

  var capValue = function(valueToCap, maxValue, minValue) {
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

      if (config.scale.overlay) {
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
  calculateOrderOfMagnitude = function(val) {
    return floor(Math.log(val) / Math.LN10);
  },
  // Populate an array of all the labels by interpolating the string.
  populateLabels = function(scale, labelTemplateString) {
    var labels = [],
      numberOfSteps = scale.steps,
      graphMin = scale.graphMin,
      stepValue = scale.stepValue;

    if (labelTemplateString) {
      // Fix floating point errors by setting to fixed the on the same decimal as the stepValue.
      for (var i = 0; i < numberOfSteps + 1; i++) {
        labels.push(
          tmpl(labelTemplateString, {
            value: (graphMin + (stepValue * i))
              .toFixed(getDecimalPlaces(stepValue))
          })
        );
      }
    }

    return labels;
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
  
  var charts = {};

  var Chart = function(canvas) {
    var chart = this,
      self = this,
      context,
      width,
      height,
      ratio,
      options;

    if (canvas.nodeType === Node.ELEMENT_NODE) {
      context = canvas.getContext('2d'),
      width = canvas.width,
      height = canvas.height,
      ratio;
    } else {
      options = canvas;
      canvas = document.createElement('canvas');
      context= canvas.getContext('2d');
      width = options.width;
      height = options.height;

      canvas.width = width;
      canvas.height = height;
      options.target.appendChild(canvas);
    }

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
      scale: {
        overlay: false,
        override: false,
        steps: null,
        stepWidth: null,
        startValue: null,
        lineColor: 'rgba(0, 0, 0, 0.1)',
        lineWidth: 1,
        showLabels: true,
        label: '<%=value%>',
        fontFamily: 'Arial',
        fontSize: 12,
        fontStyle: 'normal',
        fontColor: '#666',
        showGridLines: true,
        gridLineColor: 'rgba(0, 0, 0, .05)',
        gridLineWidth: 1,
      },

      bezierCurve: true,
      pointDot: true,
      pointDotRadius: 4,
      pointDotStrokeWidth: 2,

      datasetStroke: true,
      datasetStrokeWidth: 2,
      datasetFill: true,

      animation: true,
      animationSteps: 60, 
      animationEasing: 'easeOutQuart',
      onAnimationComplete: null
    }
  };

  var Scale = function(options) {
    this.size = options.size;
    this.config = options.config;
    this.series = options.series;
    this.offset = options.offset;
    this.stacked = options.stacked;
  };

  Scale.prototype = {};

  Scale.prototype.calculateMetrics = function() {
    var maxValue = 0,
      minValue = 0,
      maxSteps,
      minSteps,
      series = this.series,
      seriesLen = series.length,
      item,
      itemData,
      itemLen,
      dataVal,
      minArr = [], // 0 for value from 0
      maxArr = [],
      arrVal,
      stacked = this.stacked,
      i,
      j;

    for (i = 0; i < seriesLen; i++) {
      item = series[i];
      //itemData = item.data;
      itemLen = item.length;

      for (j = 0; j < itemLen; j++) {
        dataVal = item[j];

        arrVal = minArr[j];
        isFinite(arrVal) || (arrVal = Number.MAX_VALUE);

        if (!stacked && dataVal < arrVal) {
          minArr[j] = dataVal;
        }

        arrVal = maxArr[j];
        isFinite(arrVal) || (arrVal = stacked ? 0 : Number.MIN_VALUE);

        if (stacked) {
          if (dataVal < 0) {
            dataVal = 0;
          }

          maxArr[j] = arrVal + dataVal;
        } else if (dataVal > arrVal) {
          maxArr[j] = dataVal;
        }
      }
    }

    maxValue = max.apply(null, maxArr);
    minValue = stacked ? 0 : min.apply(null, minArr);
    
    /*maxSteps = floor(this.size / (labelHeight * 0.66)),
    minSteps =  floor(this.size / labelHeight * 0.5);*/

    var graphMin,
      graphMax,
      graphRange,
      stepValue,
      numberOfSteps,
      valueRange,
      rangeOrderOfMagnitude;
    
    valueRange = maxValue - minValue;
    
    rangeOrderOfMagnitude = calculateOrderOfMagnitude(valueRange);
    stepValue = pow(10, rangeOrderOfMagnitude);
    graphMin = floor(minValue / stepValue) * stepValue;
    graphMax = ceil(maxValue / stepValue) * stepValue;
    graphRange = graphMax - graphMin;
    numberOfSteps = round(graphRange / stepValue);

    // Compare number of steps to the max and min for that size graph,
    // and add in half steps if need be.

    /*while (numberOfSteps < minSteps || numberOfSteps > maxSteps) {
      if (numberOfSteps < minSteps) {
        stepValue /= 2;
        numberOfSteps = round(graphRange / stepValue);
      } else {
        stepValue *= 2;
        numberOfSteps = round(graphRange / stepValue);
      }
    }*/
    
    this.steps = numberOfSteps;
    this.stepValue = stepValue;
    this.graphMin = graphMin;
  };

  Scale.prototype.setSize = function(size) {
    this.size = size;
    this.scaleHop = floor(size / this.steps);
  };

  Scale.prototype.calculatePoint = function(val) {
    var outerValue = this.steps * this.stepValue,
      adjustedValue = val - this.graphMin,
      scalingFactor = capValue(adjustedValue / outerValue, 1, 0);

    return (this.scaleHop * this.steps) * scalingFactor;
  };

  var Plot = function(options) {
    this.xScale = options.xScale;
    this.yScale = options.yScale;
    this.charts = options.charts;
  };

  Plot.prototype = {
    setAxes: function(axes) {
      var x = axes.x[0],
        y = axes.y[0],
        series = this.series;

      var scaleData = series.map(function(serie) {
        return serie.data.map(function(val, i) {
          if (isFinite(val)) {
            return val;
          }

          if (isArray(val)) {
            return val[1];
          }

          if (typeof val === 'object' && isFinite(val.y)) {
            return val.y;
          }

          if (y.labels) {
            return i;
          }

          return null;
        });
      }),
      timelineData = data.series.map(function(serie) {
        return serie.data.map(function(val, i) {
          if (isArray(val)) {
            return val[0];
          }

          if (typeof val === 'object' && isFinite(val.x)) {
            return val.x;
          }

          return i;
        });
      });

      var xScale = new Scale({
        series: timelineData,
        labels: x.labels
      }),
      yScale = new Scale({
        series: scaleData,
        labels: y.labels
      });

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
    var gl = chart.context,
      width = chart.width,
      height = chart.height,
      stacked = config.area === 'stacked',
      rotateLabels;

    var AXIS_LEFT_PADDING = 20;

    var drawLines = function(animPc) {
      var i = 0,
        series = data.series,
        len = series.length,
        item,
        itemData,
        itemLen;

      var yPos = function(iteration) {
        var res = yScale.offset - animPc * yScale.calculatePoint(
          itemData[iteration]
        );

        return res;
      },
      xPos = function(iteration) {
        return xScale.offset + (valueHop * iteration);
      };

      for (; i < len; i++) {
        item = series[i];
        itemData = item.data;
        itemLen = itemData.length;

        gl.strokeStyle = item.strokeColor;
        gl.lineWidth = config.datasetStrokeWidth;
        gl.beginPath();
        gl.moveTo(
          xScale.offset,  
          /*yScale.offset -
            animPc * yScale.calculatePoint(itemData[0])*/
          yPos(0)
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
            i === 1 && console.log((xPos(j), yPos(j)));
            gl.lineTo(xPos(j), yPos(j));
          }
        }

        gl.stroke();

        if (config.datasetFill) {
          gl.lineTo(xPos(itemLen - 1), yScale.offset);
          gl.lineTo(xScale.offset, yScale.offset);

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
              xScale.offset + (valueHop * k),
              yScale.offset - animPc * yScale.calculatePoint(itemData[k]),
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
    drawStackedLines = function(animPc) {
      var i = 0,
        series = data.series,
        len = series.length,
        item,
        itemData,
        itemLen,
        stack = [],
        newStack = [],
        points1 = [],
        points2 = [];

      var yPos = function(index, noStack, noCalc) {
        var size = animPc * yScale.calculatePoint(
          itemData[index]
        );

        if (!noCalc) {
          var stackedVal = stack[index] || 0;
          stackedVal /*= stack[index]*/ = size + stackedVal;
          
          if (!noStack) {
            newStack.push(stackedVal);
          }

          size = yScale.offset - stackedVal;
        } else {
          size = yScale.offset - size;
        }

        return size
      },
      xPos = function(index) {
        return xScale.offset + (valueHop * index);
      };

      for (; i < len; i++) {
        item = series[i];
        itemData = item.data;
        itemLen = itemData.length;
        stackedVal = stack[0] || 0;

        gl.strokeStyle = item.strokeColor;
        gl.lineWidth = config.datasetStrokeWidth;
        gl.beginPath();
        gl.moveTo(xScale.offset, yPos(0));

        var j = 1;

        if (stack.length < itemLen) {
          stack.length = itemLen;
        }

        for (; j < itemLen; j++) {
          // not supported now
          if (config.bezierCurve/* && false*/) {
            /*points1.push({
              x: xPos(j - 0.5),
              y: yPos(j - 1, true)
            });

            points2.push({
              x: xPos(j - 0.5),
              y: yPos(j, true)
            });*/

            gl.bezierCurveTo(
              // control 1
              xPos(j - 0.5),
              yPos(j - 1, true),

              // control 2
              xPos(j - 0.5),
              yPos(j, true),

              // end
              xPos(j),
              yPos(j)
            );
          } else {
            gl.lineTo(xPos(j), yPos(j));
          }
        }

        gl.stroke();

        if (config.datasetFill) {
          stack.reverse();

          var g = 0,
            stackLen = stack.length,
            stackedVal;

          for (; g < stackLen; g++) {
            stackedVal = stack[g];

            var yVal = yScale.offset - (stackedVal || 0),
              gIndex = stack.length - (g + 1);

            if (i && g && config.bezierCurve/* && false*/) {
              /*points1.push({
                x: xPos(gIndex + 0.5),
                y: xAxisPosY - stack[g - 1]
              });

              points2.push({
                x: xPos(gIndex + 0.5),
                y: xAxisPosY - stack[g]
              });*/

              // need curve for back path
              gl.bezierCurveTo(
                // control 1
                xPos(gIndex + 0.5),
                yScale.offset - stack[g - 1],

                // control 2
                xPos(gIndex + 0.5),
                yScale.offset - stack[g],

                // end
                xPos(gIndex),
                yVal
              );
            } else {
              gl.lineTo(xPos(gIndex), yVal);
              //gl.lineTo(xPos(j), yPos(j));
            }
          }

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

          stack.reverse();

          var k = 0;

          for (; k < itemLen; k++) {
            gl.beginPath();
            gl.arc(
              xPos(k),
              yScale.offset - (newStack[k] || 0),
              config.pointDotRadius,
              0,
              Math.PI * 2,
              true
            );

            gl.fill();
            gl.stroke();
          }
        }

        stack = newStack;
        newStack = [];
      }

      /*gl.save();
      gl.fillStyle = 'red';
      gl.strokeStyle = item.pointStrokeColor;
      gl.lineWidth = config.pointDotStrokeWidth;

      points1.forEach(function(point) {
        gl.beginPath();
        gl.arc(
          point.x,
          point.y,
          config.pointDotRadius,
          0,
          Math.PI * 2,
          true
        );

        gl.fill();
        gl.stroke();
      });
      

      gl.fillStyle = 'green';
      gl.strokeStyle = item.pointStrokeColor;
      gl.lineWidth = config.pointDotStrokeWidth;

      points2.forEach(function(point) {
        gl.beginPath();
        gl.arc(
          point.x,
          point.y,
          config.pointDotRadius,
          0,
          Math.PI * 2,
          true
        );

        gl.fill();
        gl.stroke();
      });
      gl.closePath();
      gl.restore();*/
    },
    drawScale = function() {
      // X axis line

      gl.lineWidth = config.scale.lineWidth;
      gl.strokeStyle = config.scale.lineColor;
      gl.beginPath();
      gl.moveTo(width - AXIS_LEFT_PADDING + 5, yScale.offset);
      gl.lineTo(width - AXIS_LEFT_PADDING - xScale.size - 5, yScale.offset);
      gl.stroke();
      
      if (rotateLabels > 0) {
        gl.save();
        gl.textAlign = 'right';
      } else {
        gl.textAlign = 'center';
      }

      gl.fillStyle = config.scale.fontColor;

      var i = 0,
        labels = data.labels,
        labelsLen = labels.length;

      for (; i < labelsLen; i++) {
        gl.save();

        if (rotateLabels > 0) {
          gl.translate(
            xScale.offset + i * valueHop,
            yScale.offset + config.scale.fontSize
          );

          gl.rotate(-rotateLabels * (Math.PI / 180));
          gl.fillText(labels[i], 0, 0);
          // moved from here
        } else {
          if (i && i !== labelsLen - 1) {
            gl.textAlign = 'center';
          } else {
            gl.textAlign = i ? 'end' : 'start';
          }

          gl.fillText(
            labels[i],
            xScale.offset + i * valueHop,
            yScale.offset + config.scale.fontSize + 3
          );
        }

        gl.restore(); // moved from ^

        gl.beginPath();
        gl.moveTo(xScale.offset + i * valueHop, yScale.offset + 3);
        
        // Check i isnt 0, so we dont go over the Y axis twice.
        if (config.scale.showGridLines && i > 0) {
          gl.lineWidth = config.scale.gridLineWidth;
          gl.strokeStyle = config.scale.gridLineColor;
          gl.lineTo(xScale.offset + i * valueHop, 5);
        } else {
          gl.lineTo(xScale.offset + i * valueHop, yScale.offset + 3);
        }

        gl.stroke();
      }
      
      // Y axis

      gl.lineWidth = config.scale.lineWidth;
      gl.strokeStyle = config.scale.lineColor;
      gl.beginPath();
      gl.moveTo(xScale.offset, yScale.offset + 5);
      gl.lineTo(xScale.offset, 5);
      gl.stroke();
      
      gl.textAlign = 'right';
      gl.textBaseline = 'middle';

      var j = 0,
        steps = yScale.steps;

      for (; j < steps + 1; j++) {
        gl.beginPath();

        gl.moveTo(xScale.offset - 3, yScale.offset - (j + 1) * yScale.scaleHop);

        if (config.scale.showGridLines) {
          gl.lineWidth = config.scale.gridLineWidth;
          gl.strokeStyle = config.scale.gridLineColor;
          gl.lineTo(xScale.offset + xScale.size + 5, yScale.offset - (j + 1) * yScale.scaleHop);
        } else {
          gl.lineTo(xScale.offset - 0.5, yScale.offset - (j + 1) * yScale.scaleHop);
        }
        
        gl.stroke();
        
        if (config.scale.showLabels) {
          gl.fillText(calculatedLabels[j], xScale.offset - 8, yScale.offset - j * yScale.scaleHop);
        }
      }
    };

    var yData = data.series.map(function(serie) {
      return serie.data;
    }),
    xData = data.series.map(function(serie) {
      return serie.data.map(function(val, i) {
        return i;
      });
    });

    var yScale,
      xScale;

    (function() {
      var maxSize = height;

      // Need to check the X axis first - measure the length of each text metric,
      // and figure out if we need to rotate by 45 degrees.
      gl.font = config.scale.fontStyle + ' ' +
        config.scale.fontSize + 'px ' + config.scale.fontFamily;

      var widestXLabel = 0;

      var i = 0,
        labels = data.labels,
        len = labels.length,
        textLength;

      for (; i < len; i++){
        textLength = gl.measureText(labels[i]).width;

        // If the text length is longer - make that equal to longest text!
        widestXLabel = (textLength > widestXLabel) ? textLength : widestXLabel;
      }

      if (width / len < widestXLabel) {
        rotateLabels = 45;

        if (width / len < cos(rotateLabels) * widestXLabel) {
          rotateLabels = 90;
          maxSize -= widestXLabel;
          maxSize -= 10;
        } else {
          maxSize -= sin(rotateLabels) * widestXLabel;
          maxSize -= 5;
        }
      } else {
        maxSize -= config.scale.fontSize;
      }

      // Add a little padding between the x line and the text
      maxSize -= config.scale.fontSize + 10;

      // Set 5 pixels greater than the font size to allow for a little padding from the X axis.
      // Then get the area above we can safely draw on.

      yScale = new Scale({
        series: yData,
        offset: maxSize + /*config.scale.fontSize / 2*/ 10,
        stacked: stacked
      });

      yScale.calculateMetrics();
      yScale.setSize(maxSize);
    }());

    var valueHop,
      calculatedLabels = populateLabels(yScale, config.scale.label);

    (function() {
      var longestText = 0;

      // if we are showing the labels
      if (config.scale.showLabels) {
        gl.font = config.scale.fontStyle + ' ' +
          config.scale.fontSize + 'px ' + config.scale.fontFamily;

        var i = 0,
          labels = calculatedLabels,
          len = labels.length
          measuredText;

        for (; i < len; i++) {
          var measuredText = gl.measureText(labels[i]).width;

          longestText = (measuredText > longestText) ?
            measuredText : longestText;
        }
      }

      // Add a little extra padding from the y axis
      // longestText += 10;

      console.log('longestText', longestText);

      var xSize = width - longestText - AXIS_LEFT_PADDING * 2;

      valueHop = floor(xSize / (data.labels.length - 1));
        
      // in x
      // yAxisPosX = width - widestXLabel / 2 - xSize;

      // in y
      // xAxisPosY = scaleHeight + config.scale.fontSize / 2;

      xScale = new Scale({
        series: xData,
        offset: width - AXIS_LEFT_PADDING - xSize
      });

      xScale.calculateMetrics();
      xScale.setSize(xSize);
      console.log('value hop:', valueHop);
    }());

    console.log(xScale, yScale);

    animationLoop(config, drawScale, stacked ? drawStackedLines : drawLines, chart);
  };

  window.Chart = Chart;


  //Javascript micro templating by John Resig -
  // source at http://ejohn.org/blog/javascript-micro-templating/
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
      var s = 1.70158,
        p,
        a = 1;

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
    easeOutElastic: function(t) {
      var s = 1.70158,
        p,
        a = 1;

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
    easeInOutElastic: function(t) {
      var s = 1.70158,
        p,
        a = 1;

      if (!t || t === 1) return t;
      p = 1 * (0.3 * 1.5);

      /*if (a < 1) {
        a = 1;
        s = p / 4;
      } else {*/
        s = p / (2 * Math.PI) * Math.asin(1 / a);
      //}

      if (t < 1) {
        return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * sin((t * 1 - s) * (2 * Math.PI) / p));
      }

      return a * Math.pow(2, -10 * (t -= 1)) * sin((t * 1 - s) * (2 * Math.PI) / p) * 0.5 + 1;
    },
    easeInBack: function(t) {
      var s = 1.70158;
      return 1*(t/=1)*t*((s+1)*t - s);
    },
    easeOutBack: function(t) {
      var s = 1.70158;
      return 1*((t=t/1-1)*t*((s+1)*t + s) + 1);
    },
    easeInOutBack: function(t) {
      var s = 1.70158; 

      if ((t /= 1 / 2) < 1) {
        return 1 / 2 * (t * t * (((s *= (1.525)) + 1) * t - s));
      }

      return 1 / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2);
    },
    easeInBounce: function(t) {
      return 1 - animationOptions.easeOutBounce (1 - t);
    },
    easeOutBounce: function(t) {
      if ((t /= 1) < 1 / 2.75) {
        return 1 * (7.5625 * t * t);
      } else if (t < (2 / 2.75)) {
        return 1 * (7.5625 * (t -= (1.5 / 2.75)) * t + 0.75);
      } else if (t < (2.5 / 2.75)) {
        return 1 * (7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375);
      } else {
        return 1 * (7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375);
      }
    },
    easeInOutBounce: function(t) {
      if (t < 1 / 2) {
        return animationOptions.easeInBounce(t * 2) * 0.5;
      }

      return animationOptions.easeOutBounce(t * 2 - 1) * 0.5 + 1 * 0.5;
    }
  };
}());