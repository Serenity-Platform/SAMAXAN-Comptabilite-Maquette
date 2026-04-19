// SAMAXAN Comptabilité - Agent IA Client
// Connexion à la Netlify Function

const API_URL = '/.netlify/functions/agent-chat'

// Conversation ID actuelle (hardcodé pour maquette)
const CONVERSATION_ID = '0c61b099-5ddb-4f93-b163-f153797fb22f'

/**
 * Envoyer un message à l'Agent IA
 */
async function sendMessageToAgent(message) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversation_id: CONVERSATION_ID,
      message: message
    })
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  const data = await response.json()
  return data.message
}

// Export pour usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendMessageToAgent }
}
