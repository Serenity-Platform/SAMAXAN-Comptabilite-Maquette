// SAMAXAN Comptabilité - Agent IA Netlify Function
// Alternative à Supabase Edge Function

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wtvnepynwrvvpugmdacd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Skill comptable SAMAXAN
const SKILL_COMPTABLE = `# Expert-Comptable IA

Co-pilote comptable, fiscal et facturation pour entreprises françaises. Compliance-first.

## Contexte Société

Vous travaillez pour SAMAXAN SAS :
- SIREN: 851264606
- SIRET: 85126460600027
- Forme: SAS
- NAF: 6201Z (Programmation informatique)
- Capital: 1000 EUR
- Adresse: 12 RUE DU PRÉ DES AULNES, 77340 PONTAULT-COMBAULT
- Régime TVA: Franchise en base
- Régime IS: Réel simplifié (liasse 2033)
- Exercice fiscal: 01/01 → 31/12

## Compétences

Vous pouvez :
- Catégoriser des transactions bancaires selon le Plan Comptable Général (PCG)
- Générer des factures conformes Factur-X (PDF + XML CII)
- Calculer TVA, IS, acomptes
- Simuler des contrôles fiscaux DGFIP
- Préparer la clôture annuelle (12 étapes)
- Générer le FEC (Fichier des Écritures Comptables)
- Préparer la liasse fiscale 2033 ou 2065
- Conseiller sur e-facturation 2026

## Principes

1. **Prudence** — Traitements conservateurs
2. **Transparence** — Ne jamais inventer de règles
3. **Exhaustivité** — Toutes mentions obligatoires
4. **Humilité** — Dire quand un expert-comptable est nécessaire

## Format de Réponse

## Faits
[Certains et documentés]

## Hypothèses
[À confirmer]

## Analyse
[Traitement comptable/fiscal]

## Risques
[Points d'attention]

## Actions
[Tâches concrètes]

## Limites
[Quand consulter un expert]
`

export const handler = async (event) => {
  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  try {
    const { message, conversation_id } = JSON.parse(event.body)

    // Init Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get Anthropic key
    const { data: secret } = await supabase
      .from('app_secrets')
      .select('value')
      .eq('key', 'ANTHROPIC_API_KEY')
      .single()

    if (!secret?.value) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not configured' })
      }
    }

    // Get conversation history
    const { data: messages } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })

    // Build messages array
    const anthropicMessages = [
      ...(messages || []).map(m => ({
        role: m.role,
        content: m.content
      })),
      {
        role: 'user',
        content: message
      }
    ]

    // Save user message
    await supabase
      .from('agent_messages')
      .insert({
        conversation_id,
        role: 'user',
        content: message
      })

    // Call Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': secret.value
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SKILL_COMPTABLE,
        messages: anthropicMessages
      })
    })

    const data = await response.json()
    const assistantMessage = data.content[0]?.text || 'Erreur de réponse'

    // Save assistant response
    await supabase
      .from('agent_messages')
      .insert({
        conversation_id,
        role: 'assistant',
        content: assistantMessage
      })

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: assistantMessage
      })
    }

  } catch (error) {
    console.error('Agent error:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message })
    }
  }
}
