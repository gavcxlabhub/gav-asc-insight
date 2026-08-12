export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      atendimentos: {
        Row: {
          agente: string | null
          arquivo_origem: string | null
          atendimento_original: string | null
          ativo_receptivo: string | null
          canal: string | null
          classificacao_origem: string | null
          conta: string | null
          contato: string | null
          created_at: string | null
          dados_origem: Json | null
          data_atendimento: string | null
          data_entrada: string | null
          data_fila: string | null
          data_finalizacao: string | null
          ferramenta: string | null
          id: string
          importacao_id: string | null
          numero_externo: string | null
          primeira_mensagem_agente: string | null
          prioritario: string | null
          protocolo: string | null
          protocolo_dependente: string | null
          qia: string | null
          qic: string | null
          recorrencia_origem: string | null
          servico: string | null
          source_record_key: string | null
          status: string | null
          tag: string | null
          telefone: string | null
          tempo_atendimento: string | null
          tempo_em_fila: string | null
          tempo_pendencia: string | null
          tipo: string | null
          tmia: string | null
          tmic: string | null
        }
        Insert: {
          agente?: string | null
          arquivo_origem?: string | null
          atendimento_original?: string | null
          ativo_receptivo?: string | null
          canal?: string | null
          classificacao_origem?: string | null
          conta?: string | null
          contato?: string | null
          created_at?: string | null
          dados_origem?: Json | null
          data_atendimento?: string | null
          data_entrada?: string | null
          data_fila?: string | null
          data_finalizacao?: string | null
          ferramenta?: string | null
          id?: string
          importacao_id?: string | null
          numero_externo?: string | null
          primeira_mensagem_agente?: string | null
          prioritario?: string | null
          protocolo?: string | null
          protocolo_dependente?: string | null
          qia?: string | null
          qic?: string | null
          recorrencia_origem?: string | null
          servico?: string | null
          source_record_key?: string | null
          status?: string | null
          tag?: string | null
          telefone?: string | null
          tempo_atendimento?: string | null
          tempo_em_fila?: string | null
          tempo_pendencia?: string | null
          tipo?: string | null
          tmia?: string | null
          tmic?: string | null
        }
        Update: {
          agente?: string | null
          arquivo_origem?: string | null
          atendimento_original?: string | null
          ativo_receptivo?: string | null
          canal?: string | null
          classificacao_origem?: string | null
          conta?: string | null
          contato?: string | null
          created_at?: string | null
          dados_origem?: Json | null
          data_atendimento?: string | null
          data_entrada?: string | null
          data_fila?: string | null
          data_finalizacao?: string | null
          ferramenta?: string | null
          id?: string
          importacao_id?: string | null
          numero_externo?: string | null
          primeira_mensagem_agente?: string | null
          prioritario?: string | null
          protocolo?: string | null
          protocolo_dependente?: string | null
          qia?: string | null
          qic?: string | null
          recorrencia_origem?: string | null
          servico?: string | null
          source_record_key?: string | null
          status?: string | null
          tag?: string | null
          telefone?: string | null
          tempo_atendimento?: string | null
          tempo_em_fila?: string | null
          tempo_pendencia?: string | null
          tipo?: string | null
          tmia?: string | null
          tmic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          convidado_por: string | null
          created_at: string
          email: string
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          convidado_por?: string | null
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          convidado_por?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          created_at: string | null
          duplicados: number | null
          id: string
          invalidos: number | null
          nome_arquivo: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          registros_novos: number | null
          total_lido: number | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          duplicados?: number | null
          id?: string
          invalidos?: number | null
          nome_arquivo?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_novos?: number | null
          total_lido?: number | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          duplicados?: number | null
          id?: string
          invalidos?: number | null
          nome_arquivo?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          registros_novos?: number | null
          total_lido?: number | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "visualizador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "visualizador"],
    },
  },
} as const
