const socket = io();
let msg = new SpeechSynthesisUtterance();
let voice = undefined;
const synth = window.speechSynthesis;
let authorizeToSpeak = false;
let normal = true;
let wb = false;
let bw = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
let activeRecognition = false;


showdown.extension('codehighlight', () => {
    const htmlunencode = (text) => {
      return (
        text
          .replaceAll(/&amp;/g, '&')
          .replaceAll(/&lt;/g, '<')
          .replaceAll(/&gt;/g, '>')
        );
    }
    return [
      {
        type: 'output',
        filter: (text, converter, options) => {
            // use new shodown's regexp engine to conditionally parse codeblocks
            const left  = '<pre><code\\b[^>]*>',
                right = '</code></pre>',
                flags = 'g',
                replacement = function (wholeMatch, match, left, right) {
                    // unescape match to prevent double escaping
                    match = htmlunencode(match);
                    return left + hljs.highlightAuto(match).value + right;
                };
            return showdown.helper.replaceRecursiveRegExp(text, replacement, left, right, flags);
        }
      }
    ];
});

const removeValue = (value, index, arr) => {
    // If the value at the current array index matches the specified value (2)
    if (value === ' ' || value === '') {
    // Removes the value from the original array
        arr.splice(index, 1);
        return true;
    }
    return false;
}

socket.on('marv', receive => {
    const history = document.getElementById("history");
    const converter = new showdown.Converter({ extensions: ['codehighlight'] }),
    text      = receive,
    html      = converter.makeHtml(text);
    converter.setFlavor('github');
    history.innerHTML += "<br/>Marv : ";
    history.innerHTML += html;
    history.scrollTo({
        top: history.scrollHeight,
        behavior: 'smooth'
    });
    let str = receive.toString();
    str = typeof str === 'string' ? str.split(/[.,;=?!\n]+/) : '';
    str.filter(removeValue);
    const iterator = str.values();
    synthese = setInterval(() => {
        value = iterator.next();
        if (value.value == undefined) {
            clearInterval(synthese);
            return;
        } else {
            syntheseVocale(value.value);
            talk(true);
        }
    }, 500);
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
        PopulateVoices = () => {
            voices = synth.getVoices();
            console.log(voices);
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

const startButton = async (event) => {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    activeRecognition = !activeRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.start();
    const talk = document.getElementById('talk');
    if (activeRecognition) {
        talk.style.backgroundColor = '#0707';
        talk.style.backdropFilter =  'blur(15px)';
    } else {
        recognition.stop();
        talk.style.backgroundColor = '#700';
        return;
    }


    ignore_onend = false;

    start_timestamp = event.timeStamp;

    recognition.onresult = (event) => {
        const ipString = document.getElementById("ip");
        let ip = ipString.innerHTML.replaceAll("`", "");

        const history = document.getElementById("history");
        if(event.isTrusted) {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript.replaceAll('Marc', 'Marv');
            const mobileRepeatBug = (current == 1 && transcript == event.results[0][0].transcript);
            if(!mobileRepeatBug) {
                history.innerHTML += "<br/>__________________________________________________________"
                const converter = new showdown.Converter({ extensions: ['codehighlight'] }),
                text      = transcript,
                html      = converter.makeHtml(text);
                converter.setFlavor('github');
                history.innerHTML += "<br/><br/>User : ";
                history.innerHTML += html;
                history.scrollTo({
                    top: history.scrollHeight,
                    behavior: 'smooth'
                });
                let tzOffset = Intl.DateTimeFormat().resolvedOptions().timeZone;
                console.log(tzOffset);
                socket.emit('marv', { ip : ip, message : transcript, tz : tzOffset });
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
        talk.style.backdropFilter =  'blur(15px)';
    }

    recognition.onspeechend = async () => {
        recognition.stop();
        activeRecognition = false;
        talk.style.backgroundColor = '#700';
    }

    recognition.onerror = async (event) => {
        console.error(event.error);
        recognition.stop();
        activeRecognition = false;
        talk.style.backgroundColor = '#700';
    }
}

voicesLoader.then(voices => {
    voice = voices.find(el => el.name === "Microsoft Paul - French (France)");
    if(!voice) voice = voices.find(el => el.name === "Microsoft Hortense Desktop - French");
    if(!voice) voice = voices.find(el => el.name === "Google français");
});

const syntheseVocale = async (text) => {
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

            toSpeak.onstart = (event) => {
                talk(true);
            };

            toSpeak.onend = (event) => {
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
        return authorizeToSpeak;
    } else {
        speech.style.backgroundColor = '#0707';
        speech.style.backdropFilter = 'blur(15px)';
        authorizeToSpeak = true;
        return authorizeToSpeak;
    }
}

const talk = (speak) => {
    const botAvatar = document.getElementById('bot');
    if (authorizeToSpeak && (normal || wb)) {
        botAvatar.src = speak ? 'images/botavatar.gif' : 'images/botavatar.png';
    } else if (authorizeToSpeak && bw) {
        botAvatar.src = speak ? 'images/botavatarLight-Anime.gif' : 'images/botavatarLight-default.png';
    }
    botAvatar.style.filter = speak ? 'blur(1px)' : 'blur(0px)';
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

    history.innerHTML += "<br/>__________________________________________________________";
    const converter = new showdown.Converter({ extensions: ['codehighlight'] }),
    text      = input.value,
    html      = converter.makeHtml(text);
    converter.setFlavor('github');
    history.innerHTML += "<br/><br/>User : ";
    history.innerHTML += html;
    history.scrollTo({
        top: history.scrollHeight,
        behavior: 'smooth'
    });

    const ipString = document.getElementById("ip");
    let ip = ipString.innerHTML.replaceAll("`", "");
    let tzOffset = new Date().getTimezoneOffset(),
        tzInput = document.getElementById('tzOffset');
    tzInput.value = tzOffset*(-1);
    socket.emit('marv', { ip : ip, message : input.value, tz : tzInput.value });
    input.value = "";
    if (history.selectionStart == history.selectionEnd) {
        history.scrollBottom = history.scrollHeight;
    }
};

const blackAndWhite = () => {
    document.getElementById('color-css').href='/stylesheets/bw-var.css';
    document.getElementById('botbouche').src='images/BotAvatarLight.png';
    document.getElementById('bot').src='images/botavatarLight-default.png';
    document.body.style.background="0";
    document.body.style.backgroundColor = "var(--main-bg-color);";
    normal = false;
    bw = true;
    wb = false;
}

const whiteAndBlack = () => {
    document.getElementById('color-css').href='/stylesheets/wb-var.css';
    document.getElementById('botbouche').src='images/BotAvatarDark.png';
    document.getElementById('bot').src='images/botavatar.png';
    document.body.style.background="0";
    document.body.style.backgroundColor = "var(--main-bg-color)";
    normal = false;
    wb = true;
    bw = false;
}

const color = () => {
    document.getElementById('color-css').href='/stylesheets/color-var.css';
    document.getElementById('botbouche').src='botavata-bouche.png';
    document.getElementById('bot').src='images/botavatar.png';
    document.body.style.background = "url('../images/computing.jpeg') no-repeat fixed center";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundColor = "var(--main-bg-color)";
    normal = true;
    wb = false;
    bw = false;
}