const { OPENAI_API_KEY, organization, API_NEWS } = require('./config');
const OpenAI = require("openai");
const moment = require('moment-timezone');
const { find } = require('geo-tz');
const axios = require('axios');
let newsToday = "";
const joursFeries = require("@socialgouv/jours-feries");

const openai = new OpenAI ({
	organization: organization,
	apiKey:  OPENAI_API_KEY,
});

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
    // Open-Meteo veut lat/lon, donc on géocode d'abord la ville
    await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ville)}&count=1&language=fr&format=json`)
    .then(r => r.json())
    .then(async (geo) => {
        if (!geo || !geo.results || geo.results.length === 0) return;

        const lat = geo.results[0].latitude;
        const lon = geo.results[0].longitude;

        const tz = geo.results[0].timezone || (find(lat, lon)?.[0]) || 'Europe/Paris';

        // Forecast current + daily
        await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}`
            + `&current=temperature_2m,weather_code`
            + `&daily=sunrise,sunset`
        )
        .then(r => r.json())
        .then(w => {
            if (!w || !w.current) return;

            DATA.city_temperature = Math.round(w.current.temperature_2m);

            // petit mapping weather_code -> description FR (simple)
            DATA.city_weather = getWeatherDescFR(w.current.weather_code);

            // sunrise/sunset sont déjà en timezone, format ISO
            if (w.daily && w.daily.sunrise && w.daily.sunrise[0]) {
                DATA.sun_rise = new Date(w.daily.sunrise[0]).toLocaleString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: tz,
                });
            }

            if (w.daily && w.daily.sunset && w.daily.sunset[0]) {
                DATA.sun_set = new Date(w.daily.sunset[0]).toLocaleString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: tz,
                });
            }

            DATA.timeZone = tz;
        });
    });

    return DATA;
}

const setWeatherInformationCRD = async (latitude, longitude) => {
    const tz = (find(latitude, longitude)?.[0]) || 'Europe/Paris';

    await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=${encodeURIComponent(tz)}`
        + `&current=temperature_2m,weather_code`
        + `&daily=sunrise,sunset`
    )
    .then(r => r.json())
    .then(w => {
        if (!w || !w.current) return;

        DATA.city_temperature = Math.round(w.current.temperature_2m);
        DATA.city_weather = getWeatherDescFR(w.current.weather_code);

        if (w.daily && w.daily.sunrise && w.daily.sunrise[0]) {
            DATA.sun_rise = new Date(w.daily.sunrise[0]).toLocaleString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: tz,
            });
        }

        if (w.daily && w.daily.sunset && w.daily.sunset[0]) {
            DATA.sun_set = new Date(w.daily.sunset[0]).toLocaleString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: tz,
            });
        }

        DATA.timeZone = tz;
    });

    return DATA;
}

const getCity = async (latitude, longitude) => {
    let ville;

    await fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=fr&count=1`
    )
    .then(r => r.json())
    .then(r => {
        if (r && r.results && r.results[0] && r.results[0].name) {
            ville = r.results[0].name;
            console.log("Ville = " + ville);
        }
    });

    if (ville == undefined) ville = "Paris";
    return ville;
}

const getWeatherDescFR = (code) => {
    // Mapping simple basé sur WMO weather codes
    const map = {
        0: "ciel dégagé",
        1: "plutôt dégagé",
        2: "partiellement nuageux",
        3: "couvert",
        45: "brouillard",
        48: "brouillard givrant",
        51: "bruine légère",
        53: "bruine",
        55: "bruine forte",
        61: "pluie faible",
        63: "pluie",
        65: "pluie forte",
        71: "neige faible",
        73: "neige",
        75: "neige forte",
        80: "averses faibles",
        81: "averses",
        82: "averses fortes",
        95: "orage",
        96: "orage avec grêle",
        99: "orage violent avec grêle",
    };
    return map[code] || "météo variable";
};

const actu = async () => {
    let date = new Date();
    const year = new Date().getFullYear();

    // recule si dimanche ou jour ferie
    const feries = joursFeries(year);
    for (let index in feries) {
        while (
            date.getDay() === 0 ||
            feries[index].toISOString().split('T')[0] === date.toISOString().split('T')[0]
        ) {
            date.setDate(date.getDate() - 1);
        }
    }

    date = date.toISOString().split('T')[0];

    return await axios.get(
        `https://api.mediastack.com/v1/news?access_key=${API_NEWS}&countries=fr&limit=8&sources=-franceantilles&date=${date}`
    )
    .then((response) => {
        const data = response.data.data;
        if (data && data.length > 0) {
            console.log("Titre = " + data[0].title + " ; url = " + data[0].url);
            return data;
        }
        console.log("Pas d'actualité pour le moment");
        return "Pas d'actualité pour le moment";
    })
    .catch((error) => {
        console.log(error + "\nPas d'actualité pour le moment");
        return "Pas d'actualité pour le moment";
    });
}

const RequestData = async (messageClient) => {
    // Objectif: détecter une ville (ex: "à Tours", "sur Paris", etc.)
    // Retourne juste "Tours" ou undefined si rien de fiable.

    try {
        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "Tu extrais une ville depuis un message utilisateur. Réponds uniquement en JSON strict."
                },
                {
                    role: "user",
                    content:
                        `Message: "${messageClient}"\n` +
                        `Retour JSON attendu: {"city": "NomDeVille"} ou {"city": null}\n` +
                        `Règles: si ce n'est pas clairement une ville, city=null.`
                }
            ]
        });

        const content = gptResponse.choices[0].message.content.trim();

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            return undefined;
        }

        const location = parsed && parsed.city ? String(parsed.city).trim() : null;

        if (location && location.length > 1) {
            console.log("Ville = " + location);
            return location;
        }
    } catch (error) {
        console.error(error);
    }

    return undefined;
};

const Marv = async (question, timeZon, messageClient, latitude, longitude, customPrompt) => new Promise(async(resolve, reject) => {
	console.log(question);
    
    try {
        delete DATA.city_temperature;
        delete DATA.city_weather;
        delete DATA.sun_rise;
        delete DATA.sun_set;
        delete DATA.timeZone;
        
        DATA.refresh_date = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZoneName: 'short',
            timeZone: 'Europe/Paris',
        });

        newsToday = "";
        
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
       
        let ville;
    
        if (latitude !== undefined) {
            console.log("crd = " + latitude + ' ' + longitude);
    
            await setWeatherInformationCRD(latitude, longitude);
            ville = await getCity(latitude, longitude);
            if (ville === undefined) ville = "Paris";
            
            console.log(ville);
        }
    
        let heure;
        const location = await RequestData(messageClient);
        if (location !== undefined) {
            ville = location;
            if (ville === undefined) ville = "Paris";
            await setWeatherInformation(ville);
            console.log(DATA.timeZone)
            if (DATA.timeZone !== undefined) {
                console.log(DATA.timeZone);  
                heure = moment.tz(DATA.timeZone).format('HH:mm:ss');
                console.log(heure);
            }  
        }
    
        if (ville === undefined) ville = "Paris";
        console.log('Ville = ' + ville);
    
        if (heure === undefined && timeZon !== undefined && Number.isInteger(timeZon)) {
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
    
        const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: promptToUse },  
            { role: "assistant", content: meteoDate },
            { role: "user", content: question }
            ]
        });
    
    
        const laReponse = gptResponse.choices[0].message.content;
        resolve(laReponse);  
    } catch (e) {
    console.log("une erreur s'est produit lors de l'appelle à l'API de chatGPT :", e);
    resolve("Désolé, j'ai eu un souci avec l'IA. Réessaie dans 10 secondes.");
    }
});

module.exports = { Marv }