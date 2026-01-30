-- Create export_documents table for FSMA 204 and EUDR compliance documents
-- This table stores generated export compliance documents linked to batches

CREATE TABLE IF NOT EXISTS public.export_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document metadata
  doc_type TEXT NOT NULL CHECK (doc_type IN ('fsma204', 'eudr')),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'completed', 'rejected')),
  
  -- Document content
  document_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit fields
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_export_documents_batch_id ON public.export_documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_export_documents_doc_type ON public.export_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_export_documents_status ON public.export_documents(status);
CREATE INDEX IF NOT EXISTS idx_export_documents_created_at ON public.export_documents(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_export_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_export_documents_updated_at
  BEFORE UPDATE ON public.export_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_export_documents_updated_at();

-- Enable RLS
ALTER TABLE public.export_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view export_documents from their organization"
  ON public.export_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert export_documents"
  ON public.export_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can update export_documents"
  ON public.export_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete export_documents"
  ON public.export_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE public.export_documents IS 'Stores export compliance documents (FSMA 204, EUDR) linked to batches';
COMMENT ON COLUMN public.export_documents.doc_type IS 'Type of compliance document: fsma204 (US) or eudr (EU)';
COMMENT ON COLUMN public.export_documents.document_data IS 'JSON data containing all compliance fields required by the regulation';
COMMENT ON COLUMN public.export_documents.status IS 'Document status: draft, pending review, completed, or rejected';
