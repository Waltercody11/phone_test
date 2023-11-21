var audioContext = null;
var analyser = null;
var DEBUGCANVAS = null;
var canvasElem, waveCanvas;
var isFrequencyValidated = false;
var localcall = false;

window.onload = function () {
    audioContext = new AudioContext();
    MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000));
    DEBUGCANVAS = document.getElementById( "waveform" );
    if (DEBUGCANVAS) {
        waveCanvas = DEBUGCANVAS.getContext("2d");
        waveCanvas.strokeStyle = "black";
        waveCanvas.lineWidth = 1;
    }
    document.addEventListener("keydown", function (event) {
        var phoneInput = document.getElementById("phone-input");
        var digit = event.key;
    
        if (digit === "Backspace") {
            phoneInput.value = phoneInput.value.slice(0, -1);
        } else if (/^\d$/.test(digit) && phoneInput.value.length < 13) {
            phoneInput.value += digit;
            playDTMFTone(digit);
        } else if (digit == "Enter" && phoneInput.value.length == 11) {
            call();
        }
    
    });
};
function calculateFrequency(buf, sampleRate) {
    var SIZE = buf.length;
    var rms = 0;

    for (var i = 0; i < SIZE; i++) {
        var val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) // not enough signal
        return -1;

    var r1 = 0, r2 = SIZE - 1, thres = 0.4;
    for (var i = 0; i < SIZE / 2; i++)
        if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (var i = 1; i < SIZE / 2; i++)
        if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    var c = new Array(SIZE).fill(0);
    for (var i = 0; i < SIZE; i++)
        for (var j = 0; j < SIZE - i; j++)
            c[i] = c[i] + buf[j] * buf[j + i];

    var d = 0;
    while (c[d] > c[d + 1]) d++;
    var maxval = -1, maxpos = -1;
    for (var i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    var T0 = maxpos;

    var x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    a = (x1 + x3 - 2 * x2) / 2;
    b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}

function startPitchDetect() {	
    audioContext = new AudioContext();
    navigator.mediaDevices.getUserMedia(
    {
        "audio": {
            "mandatory": {
                "googEchoCancellation": "false",
                "googAutoGainControl": "false",
                "googNoiseSuppression": "false",
                "googHighpassFilter": "false"
            },
            "optional": []
        },
    }).then((stream) => {
        mediaStreamSource = audioContext.createMediaStreamSource(stream);

	    analyser = audioContext.createAnalyser();
	    analyser.fftSize = 2048;
	    mediaStreamSource.connect( analyser );
	    updatePitch();
    }).catch((err) => {
        console.error(`${err.name}: ${err.message}`);
        alert('Stream generation failed.');
    });
}


var rafID = null;
var buflen = 2048;
var buf = new Float32Array( buflen );


function autoCorrelate( buf, sampleRate ) {
	// Implements the ACF2+ algorithm
	var SIZE = buf.length;
	var rms = 0;

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) 
		return -1;

	var r1=0, r2=SIZE-1, thres=0.2;
	for (var i=0; i<SIZE/2; i++)
		if (Math.abs(buf[i])<thres) { r1=i; break; }
	for (var i=1; i<SIZE/2; i++)
		if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }

	buf = buf.slice(r1,r2);
	SIZE = buf.length;

	var c = new Array(SIZE).fill(0);
	for (var i=0; i<SIZE; i++)
		for (var j=0; j<SIZE-i; j++)
			c[i] = c[i] + buf[j]*buf[j+i];

	var d=0; while (c[d]>c[d+1]) d++;
	var maxval=-1, maxpos=-1;
	for (var i=d; i<SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	var T0 = maxpos;

	var x1=c[T0-1], x2=c[T0], x3=c[T0+1];
	a = (x1 + x3 - 2*x2)/2;
	b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}
function playDTMFTone(digit) {
    const audioElement = document.getElementById('dtmfAudio');
    const audioFile = 'dtmf-'+digit + '.mp3'; 
    audioElement.src = audioFile;
    audioElement.play();
}
function playRing() {
    const audioElement = new Audio('ring.mp3'); 
    audioElement.play(); 
}
function playHash(){
    const audioElement = document.getElementById('dtmfAudio');
    const audioFile = 'dtmf-hash.mp3'; 
    audioElement.src = audioFile;
    audioElement.play();
}
function playStar(){
    const audioElement = document.getElementById('dtmfAudio');
    const audioFile = 'dtmf-star.mp3'; 
    audioElement.src = audioFile;
    audioElement.play();
}
function replayTones() {
    const phoneInput = document.getElementById('phone-input');
    const phoneNumber = phoneInput.value;
    
    // Iterate through each digit in the phone number and play the corresponding tone
    for (let i = 0; i < phoneNumber.length; i++) {
        const digit = phoneNumber.charAt(i);
        setTimeout(() => {
            playDTMFTone(digit);
        }, i * 200); 
    }
    
}
function readFlag(characters, delay) {
    if ('speechSynthesis' in window) {
        var speechSynthesis = window.speechSynthesis;
        var currentIndex = 0;

        function readNextCharacter() {
            if (currentIndex < characters.length) {
                var speechMsg = new SpeechSynthesisUtterance();
                var character = characters[currentIndex];
                var verbalCue = "";
                if (/[\W_]/.test(character)) {
                    // Check for special characters (non-alphanumeric and underscore)
                    switch (character) {
                        case '=':
                            verbalCue = "Equals ";
                            break;
                        case '{':
                            verbalCue = "Opening curly brace ";
                            break;
                        case '}':
                            verbalCue = "Closing curly brace ";
                            break;
                        case ';':
                            verbalCue = "Semicolon ";
                            break;
                        case ':':
                            verbalCue = "Colon ";
                            break;
                        case '-':
                            verbalCue = "Dash";
                            break;
                        case '.':
                            verbalCue = "dot";
                            break;
                        case '!':
                            verbalCue = "exclamation point";
                            break;
                        case ',':
                            verbalCue = "Comma";
                            break;
                        case '_':
                            verbalCue = "underscore";
                            break;
                        default:
                            verbalCue = character + " ";
                            break;
                    }
                }
                // Check if the character is uppercase
                else if (/[A-Z]/.test(character)) {
                    verbalCue = "Capital ";
                
                } 
                
                if(character != '_'){
                    speechMsg.text = verbalCue + character;
                }
                else{
                    speechMsg.text = verbalCue;
                }
                speechSynthesis.speak(speechMsg);
                currentIndex++;

                // Schedule reading the next character after the specified delay
                setTimeout(readNextCharacter, delay);
            }
        }

        // Start reading the characters
        readNextCharacter();
    } else {
        alert('Speech synthesis is not supported in your current browser.');
    }
}
function displayFlag(flagText) {
    var flagElement = document.getElementById('flag');
    flagElement.textContent = flagText;
    var characters = flagText.split('');

    readFlag(characters, 250); // Adjust delay as needed
}
function speakWord(word) {
    if ('speechSynthesis' in window) {
        var speechSynthesis = window.speechSynthesis;
        var speechMsg = new SpeechSynthesisUtterance(word);
        speechSynthesis.speak(speechMsg);
    } else {
        alert('Speech synthesis is not supported in your current browser.');
    }
}
// Matrix: (312)-555-0690

// Ghost busters: 555-2368

// Wargames: 311-399-0001 ----- 




function call(){
    var phoneInput = document.getElementById("phone-input");
    var badNumber = new Audio('invalidNumber.mp3')

    
    if(phoneInput.value.length == 11){
        replayTones();
        setTimeout(function(){
           playRing(); 
        },2500);
        
        setTimeout(function () {
              
            if (localcall && isFrequencyValidated) {
                if (phoneInput.value === "13373131337") {
                    var pickup = new Audio('phone-pick-up-1.mp3');
                    pickup.play();
                    speakWord("Hello? Did you pay for this call? No? Okay... here is the secret flag");
                    displayFlag("pwn.college{secret_flag}");
                }else if (phoneInput.value ==="13113990001") {
                    var greet = new Audio('greetings.mp3');
                    greet.play();
                }else {
                    badNumber.play();
                    alert("Invalid Number");

                }
            } else {
                if (phoneInput.value.startsWith("1800")) {
                    alert("Free local call started");
                    localcall = true;
                    startPitchDetect();
                    clearPhoneNumber();
                } else {
                    badNumber.play();
                    alert("Invalid Number");

                }
            }
        }, 4000);
    }
    else{
        badNumber.play();
        alert("Invalid Number");

    }
}
function playAudio(){
    var audio = document.getElementById("phone-pick-up-1.mp3");
    audio.play()
}
function appendDigit(digit) {
    var phoneInput = document.getElementById("phone-input");
    if (phoneInput.value.length < 11) {
        phoneInput.value += digit;
        playDTMFTone(digit)
    }
    
}

function clearPhoneNumber() {
    var phoneInput = document.getElementById("phone-input");
    phoneInput.value = "";
}

function updatePitch(time) {
    var cycles = new Array;
    analyser.getFloatTimeDomainData(buf);
    var ac = autoCorrelate(buf, audioContext.sampleRate);

    var isHeard1300 = Math.abs(ac - 1300) <= 50;
    var isHeard2600 = Math.abs(ac - 2600) <= 50;
    var canvas = document.getElementById("frequencyGraph");
    var ctx = canvas.getContext("2d");
    var frequency = autoCorrelate(buf, audioContext.sampleRate);
    
    // Update the frequency display
    if (frequency !== -1) {
        document.getElementById("currentFrequency").textContent = frequency.toFixed(2) + " Hz";
    } else {
        document.getElementById("currentFrequency").textContent = "-- Hz";
    }
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the frequency graph
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgb(0, 123, 255)';
    var sliceWidth = canvas.width * 1.0 / buflen;
    var x = 0;

    for (var i = 0; i < buflen; i++) {
        var v = buf[i] * 100.0;
        var y = canvas.height / 2 + v;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    // Update the displayed frequency
    //document.getElementById("frequency").textContent = (ac != -1) ? ac.toFixed(2) + " Hz" : "-- Hz";

    //2600 Hz is heard and display the result
    if ( isHeard2600) {
		isFrequencyValidated = true;
	}
	if (isFrequencyValidated){
		document.getElementById("validationFlag").textContent = "You have played a 2600hz frequency! You can now dial your long distance call for free!";

	}else {
        document.getElementById("validationFlag").textContent = "Wrong Frequency";
    }
    if (DEBUGCANVAS) {
        
        waveCanvas.clearRect(0, 0, 512, 256);
        waveCanvas.strokeStyle = "green";
        waveCanvas.beginPath();
        waveCanvas.moveTo(0, 0);
        waveCanvas.lineTo(0, 256);
        waveCanvas.moveTo(128, 0);
        waveCanvas.lineTo(128, 256);
        waveCanvas.moveTo(256, 0);
        waveCanvas.lineTo(256, 256);
        waveCanvas.moveTo(384, 0);
        waveCanvas.lineTo(384, 256);
        waveCanvas.moveTo(512, 0);
        waveCanvas.lineTo(512, 256);
        waveCanvas.stroke();
        waveCanvas.strokeStyle = "white";
        waveCanvas.beginPath();
        waveCanvas.moveTo(0, buf[0]);
        for (var i = 1; i < 512; i++) {
            waveCanvas.lineTo(i, 128 + (buf[i] * 128));
        }
        waveCanvas.stroke();
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = window.webkitRequestAnimationFrame;
    rafID = window.requestAnimationFrame(updatePitch);
}
    if (DEBUGCANVAS) {
        waveCanvas = DEBUGCANVAS.getContext("2d");
        waveCanvas.strokeStyle = "black";
        waveCanvas.lineWidth = 1;
    }





