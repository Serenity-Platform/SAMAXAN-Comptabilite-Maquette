
-- ============================================================================
-- Paperasse Lot 0 - Seed moteur TVA v1 (10 règles de base)
-- Couverture v1: B2C FR, B2B FR, B2B UE autoliq, export hors UE, franchise 293B,
-- achats FR déductibles, imports UE/hors UE autoliq, taux réduits 5.5 et 10%
-- ============================================================================

INSERT INTO compta.tva_rules (rule_code, rule_version, effective_from, effective_to, dimensions, result, priority, status) VALUES
-- Ventes FR B2C taux normal 20%
('TVA_FR_B2C_STANDARD_20', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"sale","seller_country":"FR","buyer_country":"FR","buyer_type":"b2c","goods_type":"goods"}'::jsonb,
 '{"vat_rate":0.20,"collectible":true,"deductible":false,"autoliquidation":false,"exoneration":false,"cgi_ref":"art. 278 CGI"}'::jsonb,
 100, 'active'),
-- Ventes FR B2C taux réduit 10%
('TVA_FR_B2C_REDUCED_10', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"sale","seller_country":"FR","buyer_country":"FR","buyer_type":"b2c","goods_type":"goods_intermediate"}'::jsonb,
 '{"vat_rate":0.10,"collectible":true,"deductible":false,"cgi_ref":"art. 279 CGI"}'::jsonb,
 110, 'active'),
-- Ventes FR B2C taux réduit 5.5%
('TVA_FR_B2C_REDUCED_55', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"sale","seller_country":"FR","buyer_country":"FR","buyer_type":"b2c","goods_type":"goods_essential"}'::jsonb,
 '{"vat_rate":0.055,"collectible":true,"deductible":false,"cgi_ref":"art. 278-0 bis CGI"}'::jsonb,
 110, 'active'),
-- Ventes FR B2B standard 20%
('TVA_FR_B2B_STANDARD_20', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"sale","seller_country":"FR","buyer_country":"FR","buyer_type":"b2b"}'::jsonb,
 '{"vat_rate":0.20,"collectible":true,"deductible":false,"cgi_ref":"art. 278 CGI"}'::jsonb,
 100, 'active'),
-- Ventes intracom B2B autoliquidation (taux 0 côté vendeur, autoliq côté acheteur)
('TVA_UE_B2B_AUTOLIQ', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"sale","seller_country":"FR","buyer_type":"b2b","buyer_vat_status":"assujetti_intracom"}'::jsonb,
 '{"vat_rate":0,"collectible":false,"autoliquidation":true,"required_mention":"Autoliquidation - art. 283-2 CGI","cgi_ref":"art. 283-2 CGI"}'::jsonb,
 120, 'active'),
-- Export hors UE exonéré
('TVA_HORS_UE_EXPORT', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"sale","seller_country":"FR","channel_export":true}'::jsonb,
 '{"vat_rate":0,"collectible":false,"exoneration":true,"required_mention":"Exonération de TVA - art. 262 I CGI","cgi_ref":"art. 262 I CGI"}'::jsonb,
 120, 'active'),
-- Franchise en base (Samaxan actuellement)
('TVA_FRANCHISE_BASE', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"sale","seller_vat_status":"franchise"}'::jsonb,
 '{"vat_rate":0,"collectible":false,"required_mention":"TVA non applicable, art. 293 B du CGI","cgi_ref":"art. 293 B CGI"}'::jsonb,
 150, 'active'),
-- Achats FR TVA déductible 20%
('TVA_ACHAT_FR_DEDUCTIBLE_20', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"purchase","seller_country":"FR","buyer_country":"FR"}'::jsonb,
 '{"vat_rate":0.20,"collectible":false,"deductible":true,"cgi_ref":"art. 271 CGI"}'::jsonb,
 100, 'active'),
-- Imports UE autoliquidation TVA
('TVA_IMPORT_UE_AUTOLIQ', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"purchase","buyer_country":"FR","seller_country_intracom":true}'::jsonb,
 '{"vat_rate":0.20,"collectible":true,"deductible":true,"autoliquidation":true,"required_mention":"Autoliquidation TVA import intracom","cgi_ref":"art. 256 bis CGI"}'::jsonb,
 120, 'active'),
-- Imports hors UE autoliquidation (depuis 2022)
('TVA_IMPORT_HORS_UE_AUTOLIQ', '2026.1', '2026-01-01', NULL,
 '{"operation_type":"purchase","buyer_country":"FR","seller_country_non_ue":true}'::jsonb,
 '{"vat_rate":0.20,"collectible":true,"deductible":true,"autoliquidation":true,"required_mention":"Autoliquidation TVA import hors UE","cgi_ref":"art. 1695 II CGI"}'::jsonb,
 120, 'active')
ON CONFLICT (rule_code, effective_from) DO NOTHING;
