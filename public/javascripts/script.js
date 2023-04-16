const socket = io();
let msg = new SpeechSynthesisUtterance();
let voice = undefined;
const synth = window.speechSynthesis;
let authorizeToSpeak = false;

socket.on('marv', receive => {
    console.log(receive);
    const history = document.getElementById("history");
    const converter = new showdown.Converter(),
    text      = receive,
    html      = converter.makeHtml(text);
    converter.setFlavor('github');
    history.innerHTML += "\nMarv : ";
    history.innerHTML += html;
    syntheseVocale(receive);
})

if ('speechSynthesis' in window) {
    // Speech Synthesis supported 🎉
} else {
    // Speech Synthesis Not Supported 😣
    alert("Sorry, your browser doesn't support text to speech!");
}

const voicesLoader = new Promise((resolve, reject) => {
    if(synth) {
        let voices = [];
        function PopulateVoices() {
            voices = synth.getVoices();
            if(voices.length > 0) {
                resolve(voices);
            } else {
                reject("unable to load voices");
            }
        }
        if(synth !== undefined) {
            speechSynthesis.onvoiceschanged = PopulateVoices;
            setTimeout(PopulateVoices, 100);
        } else {
            reject("unable to load voices");
        }
    } else {
        reject("unable to load voices");
    }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

let activeRecognition = false;

const startButton = (event) => {
    activeRecognition = !activeRecognition;
    recognition = new SpeechRecognition();
    console.log(event);
    recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.start();
    const talk = document.getElementById('talk');
    if (activeRecognition) {
        talk.style.backgroundColor = '#0707';
    } else {
        recognition.stop();
        talk.style.backgroundColor = '#700';
        return;
    }


    ignore_onend = false;

    start_timestamp = event.timeStamp;

    recognition.onresult = (event) => {
        const history = document.getElementById("history");
        if(event.isTrusted) {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript.replace('Marc', 'Marv');
            const mobileRepeatBug = (current == 1 && transcript == event.results[0][0].transcript);
            if(!mobileRepeatBug) {
                history.innerHTML += "\n_____________________________________________"
                const converter = new showdown.Converter(),
                text      = transcript,
                html      = converter.makeHtml(text);
                converter.setFlavor('github');
                history.innerHTML += "\n\nUser : ";
                history.innerHTML += html;
                socket.emit('marv', transcript);
            }
        }
        if (history.selectionStart == history.selectionEnd) {
            history.scrollBottom = history.scrollHeight;
        }
    };

    recognition.onend = () => {
        recognition.start();
        activeRecognition = true;
        talk.style.backgroundColor = '#0707';
    }

    recognition.onspeechend = async () => {
        recognition.stop();
        activeRecognition = false;
        talk.style.backgroundColor = '#700';
    }

    recognition.onerror = async (event) => {
        recognition.stop();
        activeRecognition = false;
        talk.style.backgroundColor = '#700';
    }
}

voicesLoader.then(voices => {
    voice = voices.find(el => el.name === "Microsoft Paul - French (France)");
    if(!voice) voice = voices.find(el => el.name === "Microsoft Hortense Desktop - French");
});

const syntheseVocale = text => {
    if (authorizeToSpeak) {
        return new Promise((resolve, reject) => {
            const toSpeak = new SpeechSynthesisUtterance(text);
            toSpeak.lang = "fr-FR";
            toSpeak.rate = 1;
            toSpeak.voice = voice;
            toSpeak.addEventListener("end", () => {
                resolve();
            });

            synth.speak(toSpeak);
            talk(true);

            toSpeak.onend = (event) => {
                console.log(event)
                talk(false);
            };
        });
    }
} 

const toggleSynth = (event) => {
    const speech = document.getElementById('speech');
    if (authorizeToSpeak) {
        synth.cancel();
        talk(false);
        speech.style.backgroundColor = '#700';
        authorizeToSpeak = false;
        return;
    } else {
        speech.style.backgroundColor = '#0707';
        authorizeToSpeak = true;
        return;
    }
}





const talk = (speak) => {
    console.log("speak " + speak);
    if (speak)  {
        document.getElementById('bot').src = 'images/botavatar.gif';
    } else {
        document.getElementById('bot').src = 'images/botavatar.png';
    }
}

// Execute a function when the user presses a key on the keyboard
const preventMoving = (event) => { 
    // If the user presses the "Enter" key on the keyboard
    if (event.key === "Enter") {
        sendMessage();
        // Cancel the default action, if needed
        event.preventDefault();
    } 
};

const sendMessage = () => {
    // Get the input field
    let input = document.getElementById("text-input");
    const history = document.getElementById("history");

    console.log(input.value);
    history.innerHTML += "\n_____________________________________________";
    const converter = new showdown.Converter(),
    text      = input.value,
    html      = converter.makeHtml(text);
    converter.setFlavor('github');
    history.innerHTML += "\n\nUser : ";
    history.innerHTML += html;
    socket.emit('marv', input.value);
    input.value = "";
    if (history.selectionStart == history.selectionEnd) {
        history.scrollBottom = history.scrollHeight;
    }
};