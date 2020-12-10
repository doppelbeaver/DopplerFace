var lineChart = new Chart(document.getElementById('canvas').getContext('2d'), {
    type: 'line',
    data: {
          datasets: [{
              label: 'left',
              fill: false,
              lineTension: 0,
              backgroundColor: 'rgb(255, 0, 0)',
              borderColor: 'rgb(255, 0, 0)',
              data: []
            }, {
              label: 'right',
              fill: false,
              lineTension: 0,
              backgroundColor: 'rgb(0, 0, 255)',
              borderColor: 'rgb(0, 0, 255)',
              data: []
            }]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    suggestedMin: 0,
                    suggestedMax: 35
                }
            }],
        xAxes: [{
          type: "linear", // MANDATORY TO SHOW YOUR POINTS! (THIS IS THE IMPORTANT BIT) 
          display: true, // mandatory
        }], 
      }
    } 
});

var timeStep  = 0;
var calibrationData = {
      calibrationOn: true,
      previousDiff: 0,
      previousDirection: 0,
      directionChanges: 0,
      iteration: 0,
      maxVolumeRatio: 0.01,
      iterationCycles: 20,
      upThreshold: 5,
      downThreshold: 0,
      upAmount: 1.1,
      downAmount: 0.95
    };



var freqBoundary = 33;
var lineBoundary = 100;
var windowBound = 50;
var freq = 20000;
var threshold = 200;
var touch = -1;
var warningDelta = 200;
var initTime = 1000;

var sign = function(x) {
      return typeof x === 'number' ? x ? x < 0 ? -1 : 1 : x === x ? 0 : 0 : 0;
}

document.getElementById("ready").addEventListener('click', function() {
    window.doppler = (function() {
      //First we call Audio Context to help manipulate audio 
      var context = new (window.AudioContext ||
                     window.webkitAudioContext ||
                     window.mozAudioContext ||
                     window.oAudioContext ||
                     window.msAudioContext);
      var oscillator = context.createOscillator();
      var interval = 0;



      //set up the fuction to read mic data whether calibration is on or off
      var readMic = function(analyser, userCallback) {
          var audioData = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(audioData);
          var primaryTone = Math.round( freq/(context.sampleRate / 2) * analyser.fftSize/2 );
        
          var primaryVolume = audioData[primaryTone];
        

          var maxVolumeRatio = 0.01;
          var rightBandwidth = 0;
          var leftBandwidth = 0;

          do {
            leftBandwidth++;
            var volume = audioData[primaryTone-leftBandwidth];
            var normalizedVolume = volume / primaryVolume;
          } while (normalizedVolume > calibrationData.maxVolumeRatio && leftBandwidth < freqBoundary);

          
          do {
            rightBandwidth++;
            var volume = audioData[primaryTone+rightBandwidth];
            var normalizedVolume = volume / primaryVolume;
          } while (normalizedVolume > calibrationData.maxVolumeRatio && rightBandwidth < freqBoundary);
          var band =  { left: leftBandwidth, right: rightBandwidth, diff: leftBandwidth-rightBandwidth };

          if (calibrationData.calibrationOn == true){
            var direction = sign(band.diff);
            if (calibrationData.previousDirection != direction) {
              calibrationData.directionChanges++;
              calibrationData.previousDirection = direction;
            }

            // make sure that the calubration only happen after x cycles
            calibrationData.iteration = ((calibrationData.iteration + 1) % calibrationData.iterationCycles);
            if (calibrationData.iteration == 0) {
              if (calibrationData.directionChanges >= calibrationData.upThreshold) calibrationData.maxVolumeRatio *= calibrationData.upAmount;
              if (calibrationData.directionChanges <= calibrationData.downThreshold) calibrationData.maxVolumeRatio *= calibrationData.downAmount;

             
              calibrationData.maxVolumeRatio = Math.min(0.95, calibrationData.maxVolumeRatio);
              calibrationData.maxVolumeRatio = Math.max(0.0001, calibrationData.maxVolumeRatio);
              calibrationData.directionChanges = 0;
            }
            
          }

          userCallback(band);

          interval= setTimeout(readMic, 1, analyser, userCallback);
      };

      //In this function we handle the stream of audio in terms of its Doppler tone and calibration
      var handleMic = function(stream,  userCallback) {
        // Loading microphone
        var microphone = context.createMediaStreamSource(stream);
        var analyser = context.createAnalyser();
        analyser.smoothingTimeConstant = 0.5;
        analyser.fftSize = 4096;
        microphone.connect(analyser);
        oscillator.frequency.value = freq;
        oscillator.type = "sine";
        oscillator.start(0);
        oscillator.connect(context.destination);

        //This is to optimize the doppler tone. At first, you might see that the sound is singificantly high.
        setTimeout(function() {
          var oldFreq = oscillator.frequency.value;
          var audioData = new Uint8Array(analyser.frequencyBinCount);
          var maxAmplitude = 0;
          var maxAmplitudeIndex = 0;

          var from = Math.round( 19000/(context.sampleRate / 2) * analyser.fftSize/2 );
          var to = Math.round( 22000/(context.sampleRate / 2) * analyser.fftSize/2 );

          for (var i = from; i < to; i++) {
            oscillator.frequency.value = (context.sampleRate / 2)/(analyser.fftSize/2) * i;
            analyser.getByteFrequencyData(audioData);

            if (audioData[i] > maxAmplitude) {
              maxAmplitude = audioData[i];
              maxAmplitudeIndex= i;
            }
          }
          
          if (maxAmplitudeIndex == 0) {
            freq = oldFreq;
          }
          else {
            freq = (context.sampleRate / 2)/(analyser.fftSize/2) * maxAmplitudeIndex;
          }


          oscillator.frequency.value = freq;

          clearInterval(interval);
          readMic(analyser, userCallback);
          
        });
      };
    
      //Check whether the caubration is on
      var calibrate = function(newVal) {
        if (typeof newVal == "boolean") {
          calibrationData.calibrationOn = newVal;                
        }
        return calibrationData.calibrationOn;
      };

      return {
        init: function(callback) {
          navigator.getUserMedia_ = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
          navigator.getUserMedia_({ audio: { optional: [{ echoCancellation: false }] } }, function(stream) {
            handleMic(stream, callback);
          }, function() { console.log('Error!') });
        },
        stop: function () {
          clearInterval(interval);
        },
        calibrate: calibrate
      }
  })(window, document);
});


document.getElementById("start").addEventListener('click', function() {
  window.doppler.init(function(bandwidth) {
    if (document.getElementById("pause").checked) {
      return;
    }
    if (lineChart.data.datasets[0].data.length >= lineBoundary) {
      lineChart.data.datasets[0].data.shift();
    }
    lineChart.data.datasets[0].data.push({ y: bandwidth.left, x: timeStep });
    if (lineChart.data.datasets[1].data.length >= lineBoundary) {
      lineChart.data.datasets[1].data.shift();
    }
    lineChart.data.datasets[1].data.push({ y: bandwidth.right, x: timeStep });
    lineChart.update(0);
    timeStep++;

    if (timeStep >= initTime && (touch == -1 || timeStep - touch >= warningDelta)) {
      var left_sub_right = 0;
      for (var i = lineBoundary - windowBound; i < lineBoundary; i++) {
        left_sub_right += lineChart.data.datasets[0].data[i].y;
        left_sub_right -= lineChart.data.datasets[1].data[i].y;
      }
      if (left_sub_right >= threshold) {
        document.getElementById("warning").innerText = "YOU TOUCHED YOUR FACE";
        document.getElementById("warning").style.color = "white";
        document.getElementById("warning").style.backgroundColor = "red";
        touch = timeStep;
      } else {
        document.getElementById("warning").innerText = "YOU ARE GOOD";
        document.getElementById("warning").style.color = "black";
        document.getElementById("warning").style.backgroundColor = "white";
      }
    }
  });
});