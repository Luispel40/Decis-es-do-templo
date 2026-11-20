import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, aoExpirarSessao, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(!!getToken());

  const sair = useCallback(async (avisarServidor = true) => {
    if (avisarServidor && getToken()) {
      try { await api('logout'); } catch { /* sessão já inválida */ }
    }
    setToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    aoExpirarSessao(() => { setToken(null); setUsuario(null); });
    if (!getToken()) return;
    api('me')
      .then((d) => setUsuario(d.usuario))
      .catch(() => setToken(null))
      .finally(() => setCarregando(false));
  }, []);

  // aplica tema e tamanho de fonte das configurações pessoais
  useEffect(() => {
    const cfg = usuario?.config || {};
    document.documentElement.dataset.tema = cfg.tema || 'auto';
    document.documentElement.dataset.fonte = cfg.fonte || 'normal';
  }, [usuario]);

  const entrar = useCallback(async (email, senha) => {
    const d = await api('login', { email, senha });
    setToken(d.token);
    setUsuario(d.usuario);
  }, []);

  const can = useCallback((perm) => !!usuario && (usuario.papel === 'admin' || usuario.permissoes.includes(perm)), [usuario]);

  const valor = useMemo(() => ({ usuario, setUsuario, carregando, entrar, sair, can }), [usuario, carregando, entrar, sair, can]);
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}
