import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Columns introduced by 20260925001000_importacao_grande_retornavel.sql.
// Keep this extension outside generated files until Cloud types are refreshed.
type ProcessingColumns = {
  processamento_status: string;
  processamento_etapa: string | null;
  processamento_mensagem: string | null;
  processamento_atualizado_em: string | null;
};

type Importacoes = Database["public"]["Tables"]["importacoes"];
type ImportDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "importacoes"> & {
      importacoes: {
        Row: Importacoes["Row"] & ProcessingColumns;
        Insert: Importacoes["Insert"] & Partial<ProcessingColumns>;
        Update: Importacoes["Update"] & Partial<ProcessingColumns>;
        Relationships: Importacoes["Relationships"];
      };
    };
  };
};

export const importacoesClient = supabase as unknown as SupabaseClient<ImportDatabase>;