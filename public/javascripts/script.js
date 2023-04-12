const socket = io();
let msg = new SpeechSynthesisUtterance();
let voice = undefined;
const synth = window.speechSynthesis;

socket.on('marv', receive => {
    console.log(receive);
    const history = document.getElementById("history");
    history.innerHTML += "\nMarv : " + receive;
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

voicesLoader.then(voices => {
    voice = voices.find(el => el.name === "Microsoft Paul - French (France)");
    if(!voice) voice = voices.find(el => el.name === "Microsoft Hortense Desktop - French");
});

const syntheseVocale = text => {
    return new Promise((resolve, reject) => {
        const toSpeak = new SpeechSynthesisUtterance(text);
        toSpeak.lang = "fr-FR";
        toSpeak.rate = 1;
        toSpeak.voice = voice;
        toSpeak.addEventListener("end", () => {
            resolve();
        });
        talk(true);
        synth.speak(toSpeak);

        toSpeak.onend = (event) => {
            console.log(event)
            talk(false);
        };
    });
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
    // Get the input field
    let input = document.getElementById("text-input");
    // If the user presses the "Enter" key on the keyboard
    if (event.key === "Enter") {
        // Cancel the default action, if needed
        event.preventDefault();
        // Quelque chose à faire avec l'event
        console.log(input.value);
        const history = document.getElementById("history");
        bot.src = 'images/botavatar.gif';
        history.innerHTML += "\n_____________________________________________"
        history.innerHTML += "\n\nUser : " + input.value;
        socket.emit('marv', input.value);   
        input.value = "";
    }
};



