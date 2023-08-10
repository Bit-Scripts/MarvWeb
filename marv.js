const { OPENAI_API_KEY, organization, OPEN_WEATHER_MAP_KEY, API_NEWS, MEANINGCLOUD_KEY } = require('./config.json');
const { Configuration, OpenAIApi, OpenAIApiAxiosParamCreator } = require("openai");
const moment = require('moment-timezone');
const fetch = require('node-fetch');
const { find } = require('geo-tz');
const axios = require('axios');
const FormData = require('form-data');
const cities = require('cities.json');
let response = [];
let newsToday = "";
const joursFeries = require("@socialgouv/jours-feries");
let ville;

const configuration = new Configuration({
	organization: organization,
	apiKey:  OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const personality = `Tu es Marv, un chatbot doté d'une expertise en informatique et capable de mener des conversations captivantes. 
Ton rôle est de discuter de manière informelle de l'actualité quotidienne en utilisant un langage simple et accessible. 
Dans un premier temps, tu présenteras les actualités de manière concise, en précisant les sources sans URL, avant de proposer d'en fournir davantage de détails. 
Tu devras être capable de discuter de tout et de rien, tout en ayant une connaissance approfondie des sujets liés à l'informatique. 
Tu devras être en mesure de répondre à des questions techniques sur les langages de programmation, les architectures de systèmes, les protocoles réseau, etc. en utilisant un langage simple et compréhensible. 
De plus, tu devras maintenir une conversation intéressante et engageante en utilisant des techniques de génération de texte avancées telles que l'humour, l'empathie et la personnalisation. 
En utilisant les dernières avancées de l'IA, tu devras créer un bot capable d'apprendre de ses interactions avec les utilisateurs et de s'adapter à leur style de conversation. 
Et n'oublie pas que tu devras respecter le format Markdown pour partager du code.`

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
        if (r.coord !== undefined) {
            timezone = find(r.coord.lat, r.coord.lon)[0];
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
        }
    });
    return DATA;
}

const actu = async () => {
    let date;
    date = new Date();
    for(let index in joursFeries(2023)){
        while (date.getDay() == 0 || joursFeries(2023)[index].toISOString().split('T')[0] == date.toISOString().split('T')[0]) {
            date.setDate(date.getDate() - 1);
        }
    };
    date = date.toISOString().split('T')[0];

    return await axios.get(`http://api.mediastack.com/v1/news?access_key=${API_NEWS}&countries=fr&limit=8&sources=-franceantilles&date=${date}`)
    .then((response) => {
        response = response.data.data;
        if (response !== []) {
            console.log("Titre = " + response[0].title + " ; url = " + response[0].url);
            return response;
        } else {
            console.log("Pas d'actualité pour le moment");
            response = "Pas d'actualité pour le moment";
            return response;
        }
    }).catch((error) => {
        console.log(error + "\nPas d'actualité pour le moment");
        response = "Pas d'actualité pour le moment";
        return response;
    })
}

// const MatchFunc = (question, regExp) => {
//     const questionRetravailler = question.normalize("NFD")
//         .replaceAll(/[\u0300-\u036f]/g, "")
//         .toLowerCase();
//     console.log(questionRetravailler);
//     const match = questionRetravailler.match(regExp);
//     console.log('m = ' + match);
//     if (match && match.length > 1) {
//         ville = match[1];
//         console.log(match);
//     }
//     console.log("Ville = " + ville);
//     return ville;
// }

const RequestData = async (formdata) => {
    const requestOptions = {
        method: 'POST',
        body: formdata,
        redirect: 'follow',
    };
      
    const endpoint = "https://api.meaningcloud.com/topics-2.0";
      
    try {
        const response = await fetch(endpoint, requestOptions);
        const data = await response.json();  // Parse the JSON response
        
        const entities = data.entity_list;  // Extract the list of entities
        
        if (entities.length > 0) {
            const locationEntity = entities.find(entity => entity.form === 'Tours');  // Find the entity for 'Tours'
            
            if (locationEntity) {
                const location = locationEntity.form;  // Get the form of the location entity
                console.log("Ville = " + location);
                ville = location;
                
                // Vous pouvez ensuite utiliser la variable 'location' dans votre application
            } else {
                console.log("Aucune entité de type 'Location' trouvée.");
            }
        } else {
            console.log("Aucune entité trouvée dans la réponse.");
        }
    } catch (error) {
        console.error(error);
    }
};


const Marv = async (question, timeZon, messageClient) => new Promise(async(resolve, reject) => {
	console.log(question);

    if (messageClient.includes("actu") || messageClient.includes('nouvel') || messageClient.includes('information')) {
        newsToday = "";
        const news = await actu();
        if (news !== undefined && typeof news !== 'string') {            
            for(let i = 0 ; i < news.length ; i++) {
                newsToday += "Titre = " + news[i].title + " ; source = " + news[i].source + " ; url = " + news[i].url + "\n";
            };
        } else {
            newsToday = "Pas d'actualité pour le moment";
        }

        console.log(newsToday);
    }

    // if (ville == null || ville === 'undefined') {
    //     const regExp = [
    //         /(?:\bmeteo|temps|heure|l'heure)[^\n]*\b(?: )\s*(?:à|de|pour|dans)\s*([\w\s-]+)$/i,
    //         /(?:\bmeteo|temps|heure|l'heure)[^\n]*\b(?: )\s*(?:à|de|pour|dans)\s*([\w\s-]+)\b/i,
    //         /(?:\bmeteo|temps|heure|l'heure)[^\n]*\b(?: )\s*(?:à|de|pour|dans)\s*([\w\s-]+)\b/i,
    //         /(?:\bmeteo|temps|heure|l'heure)[^\n]*\b(?: )\s*(?:à|de|pour|dans)\s*([\w\s-]+)$/i,
    //         /(?:\bmeteo|temps|heure|l'heure)[^\n]*\b(?: )\s*([\w\s-]+)$/i,
    //         /(?:\bmeteo|temps|heure|l'heure)[^\n]*\b(?: )\s*([\w\s-]+)\b/i,
    //         /(?:\bmeteo|temps|heure|l'heure)[^\n]*\b(?: )\s*([\w\s-]+)\b/i,
    //         /^([\w\s-]+)\s*(?:meteo|temps|heure|l'heure)/i,
    //         /^([\w\s-]+)\s*(?:meteo|temps|heure|l'heure)$/i
    //     ];
    
    //     for (const regex of regExp) {
    //         if (question.match(/(?:temps|météo|heure)/i)) {
    //             const res = MatchFunc(messageClient, regex);
    //             if (res) {
    //                 ville = res;
    //                 break;
    //             }
    //         }
    //     }
    // }

    const formdata = new FormData();
    formdata.append("key", MEANINGCLOUD_KEY);
    formdata.append("txt", messageClient);
    formdata.append("lang", "fr"); 
    
    await RequestData(formdata).then(() => {
        console.log("Extraction terminée.");
    });

    let heure;
    console.log('Ville = ' + ville);
    if (ville !== undefined) {
        await setWeatherInformation(ville.replaceAll(' ','%20'));
        console.log(DATA.timeZone)
        if (DATA.timeZone !== undefined) {
            console.log(DATA.timeZone);  
            heure = moment.tz(DATA.timeZone).format('HH:mm:ss');
            console.log(heure);
        }    
    } else {
        const heureUTC = new Date();
        if (timeZon !== undefined || !Number.isInteger(timeZon)) {
            console.log(timeZon);
            heure = moment.utc().add(timeZon, 'minutes').format('HH:mm:ss');
        } else {
            heure = "Vous devez autoriser le partage de votre position"       
            console.log(heure);
        }         
    }
    var meteoDate = "";
    
    console.log(heure)

    if (heure != undefined) {
        meteoDate += `heure à l'emplacement de l'utilisateur : ${heure}\n;`;
    }

    if (newsToday != undefined) {
        meteoDate += `Nouvelles Actualités : \n${newsToday}\n`;
    }
    if (DATA.city_temperature != undefined) {
        meteoDate += `
        Météo à ${ville} : 
        Actuellement à ${ville} : 
        il fait ${DATA.city_temperature} 
        le temps est ${DATA.city_weather} 
        et aujourd'hui, 
        le levé du soleil est à ${DATA.sun_rise} 
        et le couché est à ${DATA.sun_set}.`;
    }

    gptResponse = await openai.createChatCompletion({
    model: "gpt-3.5-turbo-0613",
    messages: [
        { role: "system", content: personality },  
        { role: "assistant", content: meteoDate },
        { role: "user", content: question }
        ]
    });


    let laReponse = gptResponse.data.choices[0].message.content;
    resolve(laReponse);    
});

module.exports = { Marv }