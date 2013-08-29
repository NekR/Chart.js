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

  var AXIS_LEFT_PADDING = 20;

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
  },
  calcLabelsSize = function(axis, gl) {
    var labels = axis.labels,
      widestLabel = 0,
      textLength,
      i = 0,
      len = labels.length;

    gl.save();

    gl.font = axis.config.fontStyle + ' ' +
      axis.config.fontSize + 'px ' + axis.config.fontFamily;

    for (; i < len; i++){
      textLength = gl.measureText(labels[i]).width;

      // If the text length is longer - make that equal to longest text!
      textLength > widestLabel && (widestLabel = textLength);
    }

    gl.restore();

    return widestLabel;
  },
  makeScaleSeries = function(series) {
    if (isArray(series)) {
      series.forEach(function(serie) {
        var data = serie.data;

        if (isArray(data)) {
          serie.x = [];
          serie.y = [];

          var x = serie.x,
            y = serie.y;

          data.forEach(function(val, i) {
            if (isFinite(val) && val != null) {
              y.push(val);
              x.push(i);
            } else if (isArray(val)) {
              x.push(val[0]);
              y.push(val[1]);
            } else if (typeof val === 'object') {
              x.push(val.x);
              y.push(val.y);
            } else {
              y.push(null);
              x.push(null);
            }
          });
        }
      });
    }

    return series;
  };


  
  var charts = {},
    plotCharts = {},
    axesDefaults = {
      x: {
        overlay: false,
        override: false,
        steps: null,
        stepWidth: null,
        startValue: null,
        lineColor: 'rgba(0, 0, 0, 0.1)',
        lineWidth: 1,
        showLabels: true,
        labelsTemplate: null,
        fontFamily: 'Arial',
        fontSize: 12,
        fontStyle: 'normal',
        fontColor: '#666',
        showGridLines: true,
        gridLineColor: 'rgba(0, 0, 0, .1)',
        gridLineWidth: 1,
        startAtZero: false,
        stacked: false
      },
      y: {
        overlay: false,
        override: false,
        steps: null,
        stepWidth: null,
        startValue: null,
        lineColor: 'rgba(0, 0, 0, 0.1)',
        lineWidth: 1,
        showLabels: true,
        labelsTemplate: null,
        fontFamily: 'Arial',
        fontSize: 12,
        fontStyle: 'normal',
        fontColor: '#666',
        showGridLines: true,
        gridLineColor: 'rgba(0, 0, 0, .1)',
        gridLineWidth: 1,
        startAtZero: true,
        stacked: false
      }
    };

  plotCharts.line = function(data, config, chart) {
    var gl = chart.context,
      width = chart.width,
      height = chart.height,
      series = makeScaleSeries(data.series),
      stacked;

    chart.setAxes(data.axes);

    series.forEach(function(serie) {
      chart.addSerie(serie);
    });

    stacked = chart.yConfig.stacked;


    !stacked ? (this.draw = function(animPc) {
      var i = 0,
        len = series.length,
        item,
        itemX,
        itemY,
        itemLen,
        xAxis = chart.xAxis,
        yAxis = chart.yAxis;

      animPc = 1;

      var yPos = function(iteration) {
        var res = yAxis.offset - animPc * yAxis.calculatePoint(
          itemY[iteration]
        );

        return res;
      },
      xPos = function(iteration, slice) {
        var res = animPc * xAxis.calculatePoint(
          itemX[iteration]
        );

        if (slice && slice < 0) {
          res += (res - animPc * xAxis.calculatePoint(
            itemX[iteration - 1]
          )) * slice;
        }

        // return xAxis.offset + xAxis.scaleHop * iteration;

        return xAxis.offset + res;
      };

      for (; i < len; i++) {
        item = series[i];
        itemX = item.x;
        itemY = item.y;
        itemLen = itemX.length;

        gl.strokeStyle = item.strokeColor;
        gl.lineWidth = config.datasetStrokeWidth;
        gl.beginPath();
        gl.moveTo(
          xPos(0),
          yPos(0)
        );

        console.log(xPos(0), yPos(0));

        var j = 1;

        for (; j < itemLen; j++) {
          if (config.bezierCurve) {
            gl.bezierCurveTo(
              xPos(j, -0.5),
              yPos(j - 1),
              xPos(j, -0.5),
              yPos(j),
              xPos(j),
              yPos(j)
            );
          } else {
            gl.lineTo(xPos(j), yPos(j));
          }
        }

        gl.stroke();

        if (config.datasetFill) {
          gl.lineTo(xPos(itemLen - 1), yAxis.offset);
          gl.lineTo(xPos(0), yAxis.offset);

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
              xPos(k),
              yPos(k),
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
    }) :

    (this.draw = function(animPc) {
      var i = 0,
        len = series.length,
        item,
        itemX,
        itemY,
        itemLen,
        xAxis = chart.xAxis,
        yAxis = chart.yAxis,
        stack = [],
        newStack = [],
        points1 = [],
        points2 = [];

      animPc = 1;

      var yPos = function(index, noStack, noCalc) {
        var size = animPc * yAxis.calculatePoint(
          itemY[index]
        );

        if (!noCalc) {
          var stackedVal = stack[index] || 0;
          stackedVal /*= stack[index]*/ = size + stackedVal;
          
          if (!noStack) {
            newStack.push(stackedVal);
          }

          size = yAxis.offset - stackedVal;
        } else {
          size = yAxis.offset - size;
        }

        return size
      },
      xPos = function(index, slice) {
        var res = animPc * xAxis.calculatePoint(
          itemX[index]
        );

        if (slice && slice < 0) {
          res += (res - animPc * xAxis.calculatePoint(
            itemX[index - 1]
          )) * slice;
        } 

        if (slice && slice > 0) {
          res += (animPc * xAxis.calculatePoint(
            itemX[index + 1]
          ) - res) * slice;
        }

        return xAxis.offset + res;
      };

      for (; i < len; i++) {
        item = series[i];
        itemX = item.x;
        itemY = item.y;
        itemLen = itemX.length;
        stackedVal = stack[0] || 0;

        gl.strokeStyle = item.strokeColor;
        gl.lineWidth = config.datasetStrokeWidth;
        gl.beginPath();

        gl.moveTo(xPos(0), yPos(0));

        var j = 1;

        if (stack.length < itemLen) {
          stack.length = itemLen;
        }

        for (; j < itemLen; j++) {
          if (config.bezierCurve) {
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
              xPos(j, -0.5),
              yPos(j - 1, true),

              // control 2
              xPos(j, -0.5),
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

            var yVal = yAxis.offset - (stackedVal || 0),
              gIndex = stack.length - (g + 1);

            if (i && g && config.bezierCurve) {
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
                xPos(gIndex, 0.5),
                yAxis.offset - stack[g - 1],

                // control 2
                xPos(gIndex, 0.5),
                yAxis.offset - stack[g],

                // end
                xPos(gIndex),
                yVal
              );
            } else {
              gl.lineTo(xPos(gIndex), yVal);
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
              yAxis.offset - (newStack[k] || 0),
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

      {
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
      }
    });
  };






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

  var AxisProto = {
    setSize: function(size) {
      this.size = size;
      this.scaleHop = floor(size / this.steps);
    },
    calculatePoint: function(val) {
      var outerValue = this.steps * this.stepValue,
        adjustedValue = val - this.graphMin,
        scalingFactor = capValue(adjustedValue / outerValue, 1, 0);

      return (this.scaleHop * this.steps) * scalingFactor;
    }
  };

  var Scale = function(options) {
    //this.categories = options.categories;
    this.config = options.config;
    this.series = options.series;
  };

  Scale.prototype = Object.create(AxisProto);

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
      config = this.config,
      stacked = config.stacked,
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
        isFinite(arrVal) || (arrVal = stacked ? 0 : -Number.MAX_VALUE);

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
    minValue = stacked || config.startAtZero ? 0 : min.apply(null, minArr);
    
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

    graphMin = minValue;
    graphMax = maxValue;
    numberOfSteps = 10;
    stepValue = floor(valueRange / numberOfSteps);
    
    /*rangeOrderOfMagnitude = calculateOrderOfMagnitude(valueRange);
    stepValue = pow(10, rangeOrderOfMagnitude);
    graphMin = floor(minValue / stepValue) * stepValue;
    graphMax = ceil(maxValue / stepValue) * stepValue;
    graphRange = graphMax - graphMin;
    numberOfSteps = round(graphRange / stepValue);*/

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
    this.graphMax = graphMax;
    this.minValue = minValue;
    this.maxValue = maxValue;
  };

  Scale.prototype.generateLabels = function(template) {
    var labels = [],
      numberOfSteps = this.steps,
      graphMin = this.graphMin,
      stepValue = this.stepValue,
      val,
      i;

    for (i = 0; i < numberOfSteps + 1; i++) {
      val = (graphMin + (stepValue * i))
        .toFixed(getDecimalPlaces(stepValue));
      labels.push(
        template ? tmpl(template, {
          value: val
        }) : val
      );
    }

    this.labels = labels;
  };

  var Timeline = function(options) {
    this.categories = options.categories;
    this.series = options.series;
    this.config = options.config;
  };

  Timeline.prototype = Object.create(AxisProto);
  Timeline.prototype.calculateMetrics = function() {
    var categories = this.categories,
      series = this.series,
      minValue = 0,
      maxValue = categories.length - 1,
      numberOfSteps = maxValue,
      valueRange = maxValue,
      stepValue = /*floor(valueRange / numberOfSteps)*/ 1,
      graphMin = minValue,
      graphMax = maxValue;

    this.steps = numberOfSteps;
    this.stepValue = stepValue;
    this.graphMin = graphMin;
    this.graphMax = graphMax;
    this.minValue = minValue;
    this.maxValue = maxValue;
  };

  Timeline.prototype.generateLabels = function() {
    this.labels = this.categories.concat();
  };

  window.Plot = function(canvas) {
    this.charts = [];
    this.series = [];
    this.seriesMap = {};
    this.config = defaults.line;
    this.context = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.xConfig = axesDefaults.x;
    this.yConfig = axesDefaults.y;
  };

  Plot.prototype = {
    addSerie: function(serie) {
      if (!serie.name) {
        serie.name = 'serie' + Date.now();
      }

      this.series.push(serie);
      this.seriesMap[serie.name] = serie;
    },
    setAxes: function(axes) {
      this.xConfig = mergeChartConfig(axesDefaults.x, axes.x);
      this.yConfig = mergeChartConfig(axesDefaults.y, axes.y);
    },
    updateAxes: function() {
      var series = this.series,
        x = this.xConfig,
        y = this.yConfig;

      var yData = series.map(function(serie) {
        return serie.y;
      }),
      xData = series.map(function(serie) {
        return serie.x;
      });

      var xAxis = new (x.labels ? Timeline : Scale)({
        series: xData,
        categories: x.labels,
        config: x
      }),
      yAxis = new (y.labels ? Timeline : Scale)({
        series: yData,
        categories: y.labels,
        config: y
      });

      this.xAxis = xAxis;
      this.yAxis = yAxis;

      xAxis.calculateMetrics();
      xAxis.generateLabels(x.labelsTemplate);

      yAxis.calculateMetrics();
      yAxis.generateLabels(y.labelsTemplate);

      this.prepareLabels();
    },
    prepareLabels: function() {
      var self = this,
        config = this.config,
        gl = this.context,
        height = this.height,
        width = this.width,
        xAxis = this.xAxis,
        yAxis = this.yAxis;

      // calc x axis labels
      (function() {
        var ySize = height,
          widestLabelSize = calcLabelsSize(xAxis, gl),
          rotateLabels,
          len = xAxis.labels.length;

        if (width / len < widestLabelSize) {
          rotateLabels = 45;

          if (width / len < cos(rotateLabels) * widestLabelSize) {
            rotateLabels = 90;
            ySize -= widestLabelSize;
            ySize -= 10;
          } else {
            ySize -= sin(rotateLabels) * widestLabelSize;
            ySize -= 5;
          }
        } else {
          ySize -= xAxis.config.fontSize;
        }

        // Add a little padding between the x line and the text
        ySize -= xAxis.config.fontSize + 10;

        self.rotateXLabels = rotateLabels;
        yAxis.setSize(ySize);
        yAxis.offset = ySize + /*config.scale.fontSize / 2*/ 10;
      }());

      // calc y axis labels
      (function() {
        var widestLabelSize = calcLabelsSize(yAxis, gl),
          xSize = width - widestLabelSize - AXIS_LEFT_PADDING * 2;

        xAxis.setSize(xSize);
        xAxis.offset = width - AXIS_LEFT_PADDING - xSize;
      }());
    },
    drawScale: function() {
      var xAxis = this.xAxis,
        yAxis = this.yAxis,
        config = this.config,
        rotateXLabels = this.rotateXLabels,
        gl = this.context,
        width = this.width,
        height = this.height;

      // X axis line

      gl.font = xAxis.config.fontStyle + ' ' +
        xAxis.config.fontSize + 'px ' + xAxis.config.fontFamily;

      gl.lineWidth = xAxis.config.lineWidth;
      gl.strokeStyle = xAxis.config.lineColor;
      gl.beginPath();
      gl.moveTo(width - AXIS_LEFT_PADDING + 5, yAxis.offset);
      gl.lineTo(width - AXIS_LEFT_PADDING - xAxis.size - 5, yAxis.offset);
      gl.stroke();
      
      if (rotateXLabels > 0) {
        gl.textAlign = 'right';
      } else {
        gl.textAlign = 'center';
      }

      gl.fillStyle = xAxis.config.fontColor;

      var i = 0,
        xLabels = xAxis.labels,
        xSteps = xAxis.steps;

      for (; i < xSteps + 1; i++) {
        gl.save();

        if (rotateXLabels > 0) {
          gl.translate(
            xAxis.offset + i * xAxis.scaleHop,
            yAxis.offset + xAxis.config.fontSize
          );

          gl.rotate(-rotateLabels * (Math.PI / 180));
          gl.fillText(xLabels[i], 0, 0);
          // moved from here
        } else {
          if (i && i !== xSteps) {
            gl.textAlign = 'center';
          } else {
            gl.textAlign = i ? 'end' : 'start';
          }

          gl.fillText(
            xLabels[i],
            xAxis.offset + i * xAxis.scaleHop,
            yAxis.offset + xAxis.config.fontSize + 3
          );
        }

        gl.restore(); // moved from ^

        gl.beginPath();
        gl.moveTo(xAxis.offset + i * xAxis.scaleHop, yAxis.offset + 3);
        
        // Check i isnt 0, so we dont go over the Y axis twice.
        if (xAxis.config.showGridLines && i > 0) {
          gl.lineWidth = xAxis.config.gridLineWidth;
          gl.strokeStyle = xAxis.config.gridLineColor;
          gl.lineTo(xAxis.offset + i * xAxis.scaleHop, 5);
        } else {
          gl.lineTo(xAxis.offset + i * xAxis.scaleHop, yAxis.offset + 3);
        }

        gl.stroke();
      }
      
      // Y axis

      gl.font = yAxis.config.fontStyle + ' ' +
        yAxis.config.fontSize + 'px ' + yAxis.config.fontFamily;

      gl.lineWidth = yAxis.config.lineWidth;
      gl.strokeStyle = yAxis.config.lineColor;
      gl.beginPath();
      gl.moveTo(xAxis.offset, yAxis.offset + 5);
      gl.lineTo(xAxis.offset, 5);
      gl.stroke();
      
      gl.textAlign = 'right';
      gl.textBaseline = 'middle';

      var j = 0,
        ySteps = yAxis.steps,
        yLabels = yAxis.labels;

      for (; j < ySteps + 1; j++) {
        gl.beginPath();

        gl.moveTo(xAxis.offset - 3, yAxis.offset - (j + 1) * yAxis.scaleHop);

        if (yAxis.config.showGridLines) {
          gl.lineWidth = yAxis.config.gridLineWidth;
          gl.strokeStyle = yAxis.config.gridLineColor;
          gl.lineTo(xAxis.offset + xAxis.size + 5, yAxis.offset - (j + 1) * yAxis.scaleHop);
        } else {
          gl.lineTo(xAxis.offset - 0.5, yAxis.offset - (j + 1) * yAxis.scaleHop);
        }
        
        gl.stroke();
        
        if (yAxis.config.showLabels) {
          gl.fillText(yLabels[j], xAxis.offset - 8, yAxis.offset - j * yAxis.scaleHop);
        }
      }
    },
    create: function(type, data, options) {
      type = type.toLowerCase();
      options = mergeChartConfig(defaults[type], options);
      type = new plotCharts[type](data, options, this);

      this.charts.push(type);

      return type;
    },
    render: function() {
      this.updateAxes();
      this.drawScale();

      this.charts.forEach(function(chart) {
        chart.draw();
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
      stacked = config.area === 'stacked';

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
    };

    //animationLoop(config, drawScale, stacked ? drawStackedLines : drawLines, chart);
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