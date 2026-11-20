const URL_API = import.meta.env.VITE_API_URL;
const KEY = 'decisoes_token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

let onSessaoExpirada = () => {};
export const aoExpirarSessao = (fn) => { onSessaoExpirada = fn; };

/**
 * Chama o Apps Script. Usa Content-Type text/plain para evitar o preflight CORS,
 * que o Apps Script não suporta.
 */
export async function api(action, params = {}) {
  if (!URL_API) throw new Error('VITE_API_URL não configurada. Veja o README.');
  let res;
  try {
    res = await fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: getToken(), ...params })
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique sua internet.');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Resposta inválida do servidor.');
  }
  if (!data.ok) {
    if (data.codigo === 'SESSAO') onSessaoExpirada();
    const e = new Error(data.erro || 'Erro inesperado.');
    e.codigo = data.codigo;
    throw e;
  }
  return data.dados;
}
