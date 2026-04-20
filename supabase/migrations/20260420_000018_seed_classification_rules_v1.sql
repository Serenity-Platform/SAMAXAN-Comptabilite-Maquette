
-- ============================================================================
-- Paperasse Lot 0 - Seed classification_rules v1 (règles Serenity figées)
-- tenant_id NULL = règles globales. En v3 chaque tenant peut override.
-- Format output.proposed_lines: expressions {amount_ttc}, {amount_ht}, {amount_tva}
-- résolues au runtime (Lot 2 worker de classification).
-- ============================================================================

INSERT INTO compta.classification_rules (tenant_id, rule_code, rule_version, effective_from, trigger, output, priority, status) VALUES
-- Paiement Pack Découverte Serenity (Stripe)
(NULL, 'SERENITY_PACK_DECOUVERTE', '2026.1', '2026-01-01',
 '{"event_type":"stripe_payment","external_source":"stripe","metadata_product_type":"pack_decouverte"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"512","debit_expr":"{amount_ttc}","credit":0,"label_template":"Encaissement Pack Découverte - {external_id}"},
    {"account_pcg":"706","debit":0,"credit_expr":"{amount_ht}","label_template":"Vente Pack Découverte HT"},
    {"account_pcg":"44571","debit":0,"credit_expr":"{amount_tva}","label_template":"TVA collectée 20% sur Pack Découverte"}
  ],"required_source_document":false,"auto_post":true,"tva_rule":"TVA_FR_B2B_STANDARD_20"}'::jsonb,
 120, 'active'),

-- Paiement Pack Expert Serenity
(NULL, 'SERENITY_PACK_EXPERT', '2026.1', '2026-01-01',
 '{"event_type":"stripe_payment","external_source":"stripe","metadata_product_type":"pack_expert"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"512","debit_expr":"{amount_ttc}","credit":0,"label_template":"Encaissement Pack Expert - {external_id}"},
    {"account_pcg":"706","debit":0,"credit_expr":"{amount_ht}","label_template":"Vente Pack Expert HT"},
    {"account_pcg":"44571","debit":0,"credit_expr":"{amount_tva}","label_template":"TVA collectée 20% sur Pack Expert"}
  ],"required_source_document":false,"auto_post":true,"tva_rule":"TVA_FR_B2B_STANDARD_20"}'::jsonb,
 120, 'active'),

-- Paiement connecteur marketplace (Stripe)
(NULL, 'SERENITY_MARKETPLACE_CONNECTOR', '2026.1', '2026-01-01',
 '{"event_type":"stripe_payment","external_source":"stripe","metadata_product_type":"marketplace_connector"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"512","debit_expr":"{amount_ttc}","credit":0,"label_template":"Encaissement connecteur marketplace - {external_id}"},
    {"account_pcg":"706","debit":0,"credit_expr":"{amount_ht}","label_template":"Vente connecteur marketplace HT"},
    {"account_pcg":"44571","debit":0,"credit_expr":"{amount_tva}","label_template":"TVA collectée 20% sur connecteur"}
  ],"required_source_document":false,"auto_post":true,"tva_rule":"TVA_FR_B2B_STANDARD_20"}'::jsonb,
 110, 'active'),

-- Recharge Wallet (Revolut Merchant)
(NULL, 'SERENITY_WALLET_RECHARGE', '2026.1', '2026-01-01',
 '{"event_type":"revolut_merchant_order","external_source":"revolut_merchant","metadata_type":"wallet_recharge"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"512","debit_expr":"{amount_ttc}","credit":0,"label_template":"Recharge Wallet client - {external_id}"},
    {"account_pcg":"4191","debit":0,"credit_expr":"{amount_ttc}","label_template":"Avances/acomptes client pour wallet"}
  ],"required_source_document":false,"auto_post":true}'::jsonb,
 110, 'active'),

-- Débit Wallet sur order
(NULL, 'SERENITY_WALLET_DEBIT_ORDER', '2026.1', '2026-01-01',
 '{"event_type":"wallet_transaction","metadata_type":"debit_for_order"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"4191","debit_expr":"{amount_ttc}","credit":0,"label_template":"Utilisation wallet pour order"},
    {"account_pcg":"607","debit":0,"credit_expr":"{amount_ht}","label_template":"Achat marchandises fournisseur"},
    {"account_pcg":"44566","debit":0,"credit_expr":"{amount_tva}","label_template":"TVA déductible 20%"}
  ],"required_source_document":true,"auto_post":false,"tva_rule":"TVA_ACHAT_FR_DEDUCTIBLE_20"}'::jsonb,
 110, 'active'),

-- Frais bancaires Revolut Business (pattern description)
(NULL, 'REVOLUT_BANK_FEES', '2026.1', '2026-01-01',
 '{"event_type":"revolut_business_tx","description_regex":"(?i)(fee|frais|commission|charge)"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"627","debit_expr":"{amount_ttc}","credit":0,"label_template":"Frais bancaires Revolut - {description}"},
    {"account_pcg":"512","debit":0,"credit_expr":"{amount_ttc}","label_template":"Débit compte Revolut"}
  ],"required_source_document":false,"auto_post":true}'::jsonb,
 100, 'active'),

-- Frais Stripe
(NULL, 'STRIPE_FEES', '2026.1', '2026-01-01',
 '{"event_type":"stripe_payment","metadata_fees_not_null":true}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"627","debit_expr":"{fees}","credit":0,"label_template":"Commission Stripe sur {external_id}"},
    {"account_pcg":"512","debit":0,"credit_expr":"{fees}","label_template":"Débit frais Stripe"}
  ],"required_source_document":false,"auto_post":true}'::jsonb,
 100, 'active'),

-- Commission Cdiscount - review_required (cas facilitateur à arbitrer)
(NULL, 'CDISCOUNT_COMMISSION', '2026.1', '2026-01-01',
 '{"event_type":"marketplace_commission","external_source":"cdiscount"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"622","debit_expr":"{amount_ht}","credit":0,"label_template":"Commission Cdiscount"},
    {"account_pcg":"44566","debit_expr":"{amount_tva}","credit":0,"label_template":"TVA déductible sur commission"},
    {"account_pcg":"512","debit":0,"credit_expr":"{amount_ttc}","label_template":"Débit compte marketplace"}
  ],"required_source_document":false,"auto_post":false,"review_reason":"Marketplace facilitateur - vérifier qualification"}'::jsonb,
 100, 'active'),

-- Commission Octopia - review_required
(NULL, 'OCTOPIA_COMMISSION', '2026.1', '2026-01-01',
 '{"event_type":"marketplace_commission","external_source":"octopia"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"622","debit_expr":"{amount_ht}","credit":0,"label_template":"Commission Octopia"},
    {"account_pcg":"44566","debit_expr":"{amount_tva}","credit":0,"label_template":"TVA déductible sur commission"},
    {"account_pcg":"512","debit":0,"credit_expr":"{amount_ttc}","label_template":"Débit compte marketplace"}
  ],"required_source_document":false,"auto_post":false,"review_reason":"Marketplace facilitateur - vérifier qualification"}'::jsonb,
 100, 'active'),

-- Remboursement client (refund) - review_required systématique
(NULL, 'REFUND_CUSTOMER', '2026.1', '2026-01-01',
 '{"event_type":"refund"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"709","debit_expr":"{amount_ht}","credit":0,"label_template":"RRR accordés sur vente {original_external_id}"},
    {"account_pcg":"44571","debit_expr":"{amount_tva}","credit":0,"label_template":"TVA collectée régularisée"},
    {"account_pcg":"512","debit":0,"credit_expr":"{amount_ttc}","label_template":"Remboursement client"}
  ],"required_source_document":true,"auto_post":false,"review_reason":"Vérifier cohérence avec vente originale"}'::jsonb,
 120, 'active'),

-- Upload facture fournisseur - proposition vide à classifier manuellement
(NULL, 'UPLOAD_PURCHASE_INVOICE_RAW', '2026.1', '2026-01-01',
 '{"event_type":"purchase_invoice_upload","external_source":"manual_upload"}'::jsonb,
 '{"proposed_lines":[],"required_source_document":true,"auto_post":false,"review_reason":"Classification manuelle requise pour facture fournisseur"}'::jsonb,
 50, 'active'),

-- Vente marketplace générique (sans commission spécifique)
(NULL, 'SERENITY_MARKETPLACE_SALE', '2026.1', '2026-01-01',
 '{"event_type":"serenity_order","external_source":"serenity_orders"}'::jsonb,
 '{"proposed_lines":[
    {"account_pcg":"411","debit_expr":"{amount_ttc}","credit":0,"label_template":"Client marketplace - order {external_id}"},
    {"account_pcg":"707","debit":0,"credit_expr":"{amount_ht}","label_template":"Ventes marchandises via marketplace"},
    {"account_pcg":"44571","debit":0,"credit_expr":"{amount_tva}","label_template":"TVA collectée sur vente marketplace"}
  ],"required_source_document":false,"auto_post":false,"review_reason":"Cas facilitateur à confirmer par règle TVA"}'::jsonb,
 90, 'active')
ON CONFLICT (COALESCE(tenant_id::text,'global'), rule_code, effective_from) DO NOTHING;
