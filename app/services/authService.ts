/**
 * Serviço de Autenticação
 * 
 * Este módulo fornece funções para autenticação de usuários no sistema,
 * incluindo login, cadastro e recuperação de senha.
 * 
 * Funções:
 * - login: Autentica um usuário com email e senha
 * - cadastrar: Registra um novo fornecedor no sistema
 * - recuperarSenha: Solicita recuperação de senha por email
 * 
 * @module app/services/authService
 * @author Sistema Engeman
 */

import axios from 'axios';
import { API_URL } from '../config'; 


export const login = async (email: string, senha: string) => {
  try {
    const response = await axios.post(`${API_URL}/login`, {
      email,
      senha
    });
    return response.data; 
  } catch (error) {
    console.error('Erro de login:', error);
    throw error;
  }
};


export const cadastrar = async (nome: string, cnpj: string, email: string, senha: string) => {
  try {
    const response = await axios.post(`${API_URL}/cadastro`, {
      nome,
      cnpj,
      email,
      senha
    });
    return response.data; 
  } catch (error) {
    console.error('Erro de cadastro:', error);
    throw error;
  }
};


export const recuperarSenha = async (email: string) => {
  try {
    const response = await axios.post(`${API_URL}/recuperar-senha`, {
      email
    });
    return response.data; 
  } catch (error) {
    console.error('Erro ao recuperar senha:', error);
    throw error;
  }
};
