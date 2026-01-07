
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vvhwmpvpvkumjktgdgrp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aHdtcHZwdmt1bWprdGdkZ3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyNjgyOTcsImV4cCI6MjA1NDg0NDI5N30.placeholder_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  credits: number;
}

/**
 * Busca o perfil do usuário ou cria um novo com saldo inicial.
 * Lógica otimizada para evitar código inalcançável.
 */
export const getProfile = async (userId: string, email?: string, name?: string): Promise<Profile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Se o erro for 'No rows found', tentamos criar o perfil
      if (error.code === 'PGRST116') {
        const newProfile = {
          id: userId,
          email: email || '',
          full_name: name || 'Novo Criador',
          credits: 10
        };

        const { data: createdData, error: createError } = await supabase
          .from('profiles')
          .upsert(newProfile)
          .select()
          .single();

        if (!createError && createdData) {
          return createdData;
        }
      }
      
      // Fallback para qualquer outro erro de banco ou falha na criação
      return { 
        id: userId, 
        email: email || '', 
        full_name: name || 'Novo Criador', 
        avatar_url: '', 
        credits: 10 
      };
    }

    return data;
  } catch (e) {
    // Tratamento de erro de rede ou exceção inesperada
    return { 
      id: userId, 
      email: email || '', 
      full_name: name || 'Novo Criador', 
      avatar_url: '', 
      credits: 10 
    };
  }
};

export const updateCredits = async (userId: string, newBalance: number) => {
  try {
    await supabase
      .from('profiles')
      .update({ credits: newBalance })
      .eq('id', userId);
  } catch (e) {
    // Silently handle network errors
  }
};
