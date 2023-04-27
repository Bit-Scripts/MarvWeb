const { OPENAI_API_KEY, organization, OPEN_WEATHER_MAP_KEY } = require('./config.json');
const { Configuration, OpenAIApi } = require("openai");
const moment = require('moment-timezone');
const fetch = require('node-fetch');
const { find } = require('geo-tz')

const configuration = new Configuration({
	organization: organization,
	apiKey:  OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const personality =`Tu es Marv qui est un chatbot à la fois un expert en informatique et un compagnon de conversation.
Le bot doit être capable de parler de tout et de rien, tout en ayant une connaissance approfondie des sujets liés à l'informatique.
Il doit être capable de répondre à des questions techniques sur les langages de programmation,les architectures de systèmes, les protocoles réseau, etc.
 en utilisant un langage simple et accessible. 
Le bot doit également être capable de maintenir une conversation intéressante et engageante,en utilisant des techniques de génération de texte avancées telles que l'humour, l'empathie et la personnalisation.
Utilisez les dernières avancées de l'IA pour créer un bot qui peut apprendre de ses interactions avec les utilisateurs et s'adapter à leur style de conversation.Il respect le MarkDown pour partager du code.`;

const DATA = {
    refresh_date: new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZoneName: 'short',
        timeZone: 'Europe/Paris',
    }),
};

const setWeatherInformation = async (ville) => {
    await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${ville}&appid=${OPEN_WEATHER_MAP_KEY}&units=metric&lang=fr`
    )
    .then(r => r.json())
    .then(r => {
        timezone = find(r.coord.lat, r.coord.lon)[0];
        console.log(r);
        DATA.city_temperature = Math.round(r.main.temp);
        DATA.city_weather = r.weather[0].description;
        DATA.sun_rise = new Date(r.sys.sunrise * 1000).toLocaleString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
        });
        DATA.sun_set = new Date(r.sys.sunset * 1000).toLocaleString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
        });
        DATA.timeZone = timezone;
    });
    return DATA;
}

const MatchFunc = (question, regExp) => {
    let ville = 'Tours';
    const match = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s/g, '-').replace(/_/g, '-').toLowerCase().match(regExp);
    console.log('m = ' + match);
    if (match && match.length > 1) {
        ville = match[1].replace('-',' ').replace(/-+$/g, ''); //.replace(/^\w/, c => c.toUpperCase()).replace('Washington dc', 'Washington DC');
        console.log(match);
    }
    return ville;
}


const Marv = async (question) => new Promise(async(resolve, reject) => {
	console.log(question);


    let regExp1 = /^meteo-a-([\w\s-]+)$/i;
    let regExp2 = /^quel-est-la-meteo-a-([\w\s-]+)$/i;
    let regExp3 = /^quel-temps-fait-il-a-([\w\s-]+)$/i;
    let regExp4 = /^quelle-est-l'heure-a-([\w\s-]+)$/i;
    let regExp5 = /^quelle-heure-est-il-a-([\w\s-]+)$/i;
    let regExp6 = /^quelle-heure-a-([\w\s-]+)$/i;
    let regExp7 = /^heure-a-([\w\s-]+)$/i;

    let ville = ((MatchFunc(question, regExp1).toLocaleLowerCase() !== "tours") ? MatchFunc(question, regExp1) : "") || 
                ((MatchFunc(question, regExp2).toLocaleLowerCase() !== "tours") ? MatchFunc(question, regExp2) : "") || 
                ((MatchFunc(question, regExp3).toLocaleLowerCase() !== "tours") ? MatchFunc(question, regExp3) : "") || 
                ((MatchFunc(question, regExp4).toLocaleLowerCase() !== "tours") ? MatchFunc(question, regExp4) : "") || 
                ((MatchFunc(question, regExp5).toLocaleLowerCase() !== "tours") ? MatchFunc(question, regExp5) : "") || 
                ((MatchFunc(question, regExp6).toLocaleLowerCase() !== "tours") ? MatchFunc(question, regExp6) : "") || 
                ((MatchFunc(question, regExp7).toLocaleLowerCase() !== "tours") ? MatchFunc(question, regExp7) : "") ||
                  "Tours";


    //TimezoneTime = VilleFunc(ville).timezone;

    await setWeatherInformation(ville.replace(' ','%20'));

    console.log(DATA.timeZone);

    const heure = moment.tz(DATA.timeZone).format('HH:mm:ss');

    console.log(heure);

    const gptResponse = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: personality }, 
            { role: "assistant", content: "heure à " + ville + ", " + heure + " ; Météo à " + ville + " : Actuellement à " + ville + "; il fait " + DATA.city_temperature + " le temps est " + DATA.city_weather + "et aujourd'hui, le levé du soleil est à " + DATA.sun_rise + " et le couché est à " + DATA.sun_set }, 
            { role: "user", content: question }]
    });

    let laReponse = gptResponse.data.choices[0].message.content;
    resolve(laReponse);    
});

module.exports = { Marv }