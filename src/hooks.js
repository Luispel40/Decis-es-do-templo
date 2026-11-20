import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** Carrega uma ação da API e permite recarregar. */
export function useApi(action, params, deps = []) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await api(action, params));
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, ...deps]);

  useEffect(() => { recarregar(); }, [recarregar]);
  return { dados, erro, carregando, recarregar, setDados };
}

export const usePautas = () => useApi('listarPautas');
