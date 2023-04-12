const { OPENAI_API_KEY, organization } = require('./config.json');
const { Configuration, OpenAIApi } = require("openai");

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

const Marv = question => new Promise(async(resolve, reject) => {
	console.log(question);
    const gptResponse = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "system", content: personality }, {role: "user", content: question }]
    });

    let laReponse = gptResponse.data.choices[0].message.content;
    resolve(laReponse);    
});

module.exports = { Marv }