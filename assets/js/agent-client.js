// SAMAXAN Comptabilité - Agent IA Client
// Connexion à l'Edge Function Supabase

const SUPABASE_URL = 'https://wtvnepynwrvvpugmdacd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dm5lcHlud3J2dnB1Z21kYWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0NDY5MjQsImV4cCI6MjA1MjAyMjkyNH0.V3g9Oe5tqjxiZjHcPJBmgqQl4J5UOcTcH_lQOc8KxNY'

// Conversation ID actuelle (hardcodé pour maquette)
const CONVERSATION_ID = '0c61b099-5ddb-4f93-b163-f153797fb22f'

/**
 * Envoyer un message à l'Agent IA
 * @param {string} message - Message utilisateur
 * @param {Function} onChunk - Callback pour chaque chunk de streaming
 * @returns {Promise<string>} - Message complet de l'agent
 */
async function sendMessageToAgent(message, onChunk) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      conversation_id: CONVERSATION_ID,
      message: message
    })
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`)
  }

  // Streaming SSE
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullResponse = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          if (parsed.text) {
            fullResponse += parsed.text
            if (onChunk) onChunk(parsed.text)
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  return fullResponse
}

// Export pour usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { sendMessageToAgent }
}
