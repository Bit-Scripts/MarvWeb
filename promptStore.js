let prompt = '';

function setPrompt(newPrompt) {
  prompt = newPrompt;
}

function getPrompt() {
  return prompt;
}

module.exports = { setPrompt, getPrompt };