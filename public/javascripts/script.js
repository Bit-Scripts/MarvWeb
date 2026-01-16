let socket = null;
let sessionToken = null;
let crd = null;
let crdPromise = null;
let recognition = null;
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

let soundMenuOpen = false;
let accessMenuOpen = false;

const localisationOptions = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0,
};

function isValidToken(t) {
    return typeof t === 'string' && /^[0-9a-f]+$/i.test(t) && t.length >= 32;
}

async function getToken() {
    const tokenFromDom = document.getElementById('token')?.textContent?.trim();
    const tokenFromLs = localStorage.getItem('marvToken');

    // 1) DOM
    if (isValidToken(tokenFromDom)) {
        localStorage.setItem('marvToken', tokenFromDom);
        return tokenFromDom;
    }

    // 2) localStorage
    if (isValidToken(tokenFromLs)) {
        return tokenFromLs;
    }

    // si token LS est invalide, on le vire pour eviter de boucler dessus
    if (tokenFromLs) localStorage.removeItem('marvToken');

    // 3) fallback serveur
    const r = await fetch('/api/session?t=' + Date.now(), {
        credentials: 'include',
        cache: 'no-store'
    });

    if (!r.ok) return null;
    const j = await r.json();

    if (isValidToken(j?.token)) {
        localStorage.setItem('marvToken', j.token);
        return j.token;
    }

    return null;
}

async function sendMessageInternal(message) {
    if (!message || !message.trim()) return;

    let coords = null;
    try {
        coords = await ensureCoord();
    } catch (e) {
        console.warn("No geoloc", e);
    }

    // 2) affichage local
    const history = document.getElementById("history");
    const converter = new showdown.Converter({ extensions: ['codehighlight'] });
    converter.setFlavor('github');

    history.innerHTML += "<br/>__________________________________________________________";
    history.innerHTML += "<br/><br/>User : ";
    history.innerHTML += converter.makeHtml(message);
    history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' });

    // 3) envoi socket
    if (socket?.connected) {
        socket.emit('marv', {
            message,
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
            latitude: coords?.latitude,
            longitude: coords?.longitude
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    sessionToken = await getToken();
    console.log('[token] sessionToken=', sessionToken);

    if (!sessionToken) {
        console.error("Pas de token de session");
        return;
    }

    socket = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token: sessionToken }
    });
    
    const form = document.getElementById('formPrompt');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const value = form.elements.prompt.value;
            await sendMessageInternal(value);

            const formData = new URLSearchParams();
            formData.append('prompt', value);

            const response = await fetch('/store-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
            });

            if (!response.ok) {
            console.error('store-prompt failed', response.status);
            return;
            }

            console.log(await response.text());
        });
    }

    socket.on('connect', () => console.log('Socket connecté !', socket.id));
    socket.on('connect_error', (e) => console.error('Erreur de connexion socket:', e));
    socket.on('disconnect', (r) => console.log('Socket déconnecté:', r));

    socket.on('marv', receive => {
        console.log('[marv] receive:', receive);
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
    // IMPORTANT: utilise TOUJOURS "token" (celui du DOMContentLoaded), pas localStorage
    window.__MARV_TOKEN__ = sessionToken;
});

const soundMenu = (event) => {
    event.stopPropagation();
    const talkButton = document.getElementById('talk');
    const speechButton = document.getElementById('speech');
    if (!soundMenuOpen) {
        talkButton.style.display = 'block';
        speechButton.style.display = 'block';
    } else {
        talkButton.style.display = 'none';
        speechButton.style.display = 'none';
    }
    soundMenuOpen = !soundMenuOpen;
}

const accessMenu = (event) => {
    event.stopPropagation();
    const bwButton = document.getElementById('bw');
    const wbButton = document.getElementById('wb');
    const colorButton = document.getElementById('color');
    if (!accessMenuOpen) {
        bwButton.style.display = 'block';
        wbButton.style.display = 'block';
        colorButton.style.display = 'block';
    } else {
        bwButton.style.display = 'none';
        wbButton.style.display = 'none';
        colorButton.style.display = 'none';
    }
    accessMenuOpen = !accessMenuOpen;
}

document.addEventListener("click", async function(event) {
    if (!soundMenuOpen && !accessMenuOpen) return;
    const talkButton = document.getElementById('talk');
    const speechButton = document.getElementById('speech');
    const bwButton = document.getElementById('bw');
    const wbButton = document.getElementById('wb');
    const colorButton = document.getElementById('color');
    if (soundMenuOpen) {
        talkButton.style.display = 'none';
        speechButton.style.display = 'none';
        soundMenuOpen = !soundMenuOpen;
    }
    if (accessMenuOpen) {
        bwButton.style.display = 'none';
        wbButton.style.display = 'none';
        colorButton.style.display = 'none';
        accessMenuOpen = !accessMenuOpen;
    }
});


const localisationSuccess = async (pos) => {
    crd = pos.coords;

    console.log("Votre position actuelle est :");
    console.log(`Latitude : ${crd.latitude}`);
    console.log(`Longitude : ${crd.longitude}`);
    console.log(`La précision est de ${crd.accuracy} mètres.`);
}

const localisationError = (err) => {
    console.warn(`ERREUR (${err.code}): ${err.message}`);
}

async function ensureCoord() {
    if (crd) return Promise.resolve(crd);
    if (crdPromise) return crdPromise;

    crdPromise = new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
        (pos) => { crd = pos.coords; resolve(crd); },
        () => { crd = null; resolve(null); },
        localisationOptions
        );
    });

    return crdPromise;
}

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
    event.stopPropagation();
    await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    const talk = document.getElementById('talk');
    
    if (activeRecognition) {
        recognition?.stop?.();
        activeRecognition = false;
        talk.style.backgroundColor = '#700';
        return;
    }
    
    activeRecognition = true;
    recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.start();
    talk.style.backgroundColor = '#0707';
    talk.style.backdropFilter =  'blur(15px)';

    start_timestamp = event.timeStamp;

    recognition.onresult = async (event) => {
        if(event.isTrusted) {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript.replaceAll('Marc', 'Marv');
            const mobileRepeatBug = (current == 1 && transcript == event.results[0][0].transcript);
            if (!mobileRepeatBug) {
                await sendMessageInternal(transcript);
            }
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
    voice = voices.find(el => el.name === "Microsoft Julie - French (France)");
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
    event.stopPropagation();
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
const preventMoving = async (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        const input = document.getElementById("text-input");
        const value = input.value;
        input.value = "";
        await sendMessageInternal(value);
    }
};

const blackAndWhite = (event) => {
    event.stopPropagation();
    document.getElementById('color-css').href='/stylesheets/bw-var.css';
    document.getElementById('botbouche').src='images/BotAvatarLight.png';
    document.getElementById('bot').src='images/botavatarLight-default.png';
    document.body.style.background="0";
    document.body.style.backgroundColor = "var(--main-bg-color);";
    normal = false;
    bw = true;
    wb = false;
}

const whiteAndBlack = (event) => {
    event.stopPropagation();
    document.getElementById('color-css').href='/stylesheets/wb-var.css';
    document.getElementById('botbouche').src='images/BotAvatarDark.png';
    document.getElementById('bot').src='images/botavatar.png';
    document.body.style.background="0";
    document.body.style.backgroundColor = "var(--main-bg-color);";
    normal = false;
    wb = true;
    bw = false;
}

const color = (event) => {
    event.stopPropagation();
    document.getElementById('color-css').href='/stylesheets/color-var.css';
    document.getElementById('bot').src='images/botavatar.png';
    document.getElementById('botbouche').src='images/botavatar-bouche.png';
    document.body.style.background = "url('../images/computing.jpeg') no-repeat fixed center";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundColor = "var(--main-bg-color)";
    normal = true;
    wb = false;
    bw = false;
}

const changePrompt = (event) => {
    event.stopPropagation();
    var formPrompt = document.getElementById('formPrompt');
    if (formPrompt.style.display === "none" || formPrompt.style.display === "") {
        formPrompt.style.display = "flex"; // Ou "flex", "inline", etc., selon le style que vous souhaitez
    } else {
        formPrompt.style.display = "none";
    }
}