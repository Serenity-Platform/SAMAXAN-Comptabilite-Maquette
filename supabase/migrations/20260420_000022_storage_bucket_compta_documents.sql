
-- ============================================================================
-- Paperasse Lot 0 - Bucket Storage compta-documents
-- Privé, RLS scopée tenant_id (path = {tenant_id}/{legal_entity_id}/{uuid}.ext)
-- Limite 20 Mo/fichier, mime types autorisés : pdf, png, jpg, csv, xlsx
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, owner)
VALUES (
  'compta-documents',
  'compta-documents',
  false,
  20971520,  -- 20 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[],
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS policies sur storage.objects pour ce bucket
-- Path convention : {tenant_id}/{legal_entity_id}/{filename}
-- (storage.foldername(name))[1] = tenant_id, [2] = legal_entity_id

-- Policy SELECT : user authenticated avec accès au tenant + legal_entity
CREATE POLICY "compta_documents_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compta-documents'
  AND compta.fn_user_has_access(
    (select auth.uid()),
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    'viewer'
  )
);

-- Policy INSERT : user authenticated avec rôle accountant+
CREATE POLICY "compta_documents_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compta-documents'
  AND compta.fn_user_has_access(
    (select auth.uid()),
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    'accountant'
  )
);

-- Policy DELETE : accountant+ (pour retrait de document attaché à une proposition rejetée)
CREATE POLICY "compta_documents_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'compta-documents'
  AND compta.fn_user_has_access(
    (select auth.uid()),
    ((storage.foldername(name))[1])::uuid,
    ((storage.foldername(name))[2])::uuid,
    'accountant'
  )
);

-- service_role bypass total (pour Edge Functions compta-upload-document, compta-post-worker)
CREATE POLICY "compta_documents_service_role"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'compta-documents')
WITH CHECK (bucket_id = 'compta-documents');
