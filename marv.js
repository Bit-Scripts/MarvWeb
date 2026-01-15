const fs = require('fs');
let config = {};

if (fs.existsSync('./config.json')) {
  config = require('./config.json');
}

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || config.OPENAI_API_KEY;

const organization =
  process.env.OPENAI_ORGANIZATION || config.organization;

const OPEN_WEATHER_MAP_KEY =
  process.env.OPEN_WEATHER_MAP_KEY || config.OPEN_WEATHER_MAP_KEY;

const API_NEWS =
  process.env.API_NEWS || config.API_NEWS;

const MEANINGCLOUD_KEY =
  process.env.MEANINGCLOUD_KEY || config.MEANINGCLOUD_KEY;

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

const setWeatherInformationCRD = async (latitude, longitude) => {
    await fetch(
        `https://api.openweathermap.org/data/2.5/onecall?lat=${latitude}&lon=${longitude}&appid=${OPEN_WEATHER_MAP_KEY}&units=metric&lang=fr`
    )
    .then(r => r.json())
    .then(r => {
        console.log(r);
        if (r.coord !== undefined) {
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

const getCity = async (latitude, longitude) => {
    await fetch(
        `http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&appid=${OPEN_WEATHER_MAP_KEY}&units=metric&lang=fr`
    )
    .then(r => r.json())
    .then(r => {
        if (r[0].local_names !== undefined) {
            if (r[0].local_names.fr !== undefined) {
                ville = r[0].local_names.fr
            }
            console.log("Ville = " + ville)
        }
    });
    if (ville == undefined) ville = "Paris";
    return ville;
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
        if (response !== null && response !== undefined && response.length > 0) {
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
            const locationEntity = entities.find(entity => entity.form);  // Find the entity for 'Tours'
            
            if (locationEntity) {
                const location = locationEntity.form;  // Get the form of the location entity
                console.log("Ville = " + location);
                return location; // Retournez la valeur de l'emplacement
                
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


const Marv = async (question, timeZon, messageClient, latitude, longitude, customPrompt) => new Promise(async(resolve, reject) => {
	console.log(question);
    try {
        const promptToUse = customPrompt || personality;
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
        
        const formdata = new FormData();
        formdata.append("key", MEANINGCLOUD_KEY);
        formdata.append("txt", messageClient);
        formdata.append("lang", "fr"); 
        
        let ville;
    
        if (latitude !== undefined) {
            console.log("crd = " + latitude + ' ' + longitude);
    
            await setWeatherInformationCRD(latitude, longitude);
            ville = await getCity(latitude, longitude);
            
            console.log(ville);
        }
    
        let heure;
        const location = await RequestData(formdata);
        if (location !== undefined) {
            ville = location;
            await setWeatherInformation(ville.replaceAll(' ','%20'));
            console.log(DATA.timeZone)
            if (DATA.timeZone !== undefined) {
                console.log(DATA.timeZone);  
                heure = moment.tz(DATA.timeZone).format('HH:mm:ss');
                console.log(heure);
            }  
        }
    
        console.log('Ville = ' + ville);
    
        if ( heure === undefined && (timeZon !== undefined || !Number.isInteger(timeZon)) ) {
            console.log(timeZon);
            heure = moment.utc().add(timeZon, 'minutes').format('HH:mm:ss');
        }         
    
        var meteoDate = "";
        
        console.log(heure)
    
        if (heure != undefined) {
            meteoDate += `heure à ${ville} : ${heure}\n;`;
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
    
        console.log("promptToUse :", promptToUse);
    
        gptResponse = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [
            { role: "system", content: promptToUse },  
            { role: "assistant", content: meteoDate },
            { role: "user", content: question }
            ]
        });
    
    
        let laReponse = gptResponse.data.choices[0].message.content;
        resolve(laReponse);  
    } catch (e) {
        console.log('une erreur s\'est produit lors de l\'appelle à l\'API de chatGPT :', e)
    }  
});

module.exports = { Marv }