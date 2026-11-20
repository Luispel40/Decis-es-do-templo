import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PAPEIS, PERMISSOES } from '../utils.js';

export default function Configuracoes() {
  const { usuario, setUsuario } = useAuth();
  const [nome, setNome] = useState(usuario.nome);
  const [telefone, setTelefone] = useState(usuario.telefone || '');
  const [tema, setTema] = useState(usuario.config?.tema || 'auto');
  const [fonte, setFonte] = useState(usuario.config?.fonte || 'normal');
  const [msg, setMsg] = useState({ tipo: '', texto: '' });
  const [salvando, setSalvando] = useState(false);

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [nova2, setNova2] = useState('');
  const [msgSenha, setMsgSenha] = useState({ tipo: '', texto: '' });

  const salvar = async (e) => {
    e.preventDefault();
    setMsg({ tipo: '', texto: '' });
    setSalvando(true);
    try {
      const d = await api('atualizarPerfil', { nome, telefone, tema, fonte });
      setUsuario(d.usuario);
      setMsg({ tipo: 'ok', texto: 'Configurações salvas.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    } finally {
      setSalvando(false);
    }
  };

  const trocarSenha = async (e) => {
    e.preventDefault();
    setMsgSenha({ tipo: '', texto: '' });
    if (nova !== nova2) return setMsgSenha({ tipo: 'erro', texto: 'As senhas novas não conferem.' });
    try {
      await api('trocarSenha', { senhaAtual: atual, novaSenha: nova });
      setAtual(''); setNova(''); setNova2('');
      setMsgSenha({ tipo: 'ok', texto: 'Senha alterada. Seus outros dispositivos foram desconectados.' });
    } catch (err) {
      setMsgSenha({ tipo: 'erro', texto: err.message });
    }
  };

  return (
    <>
      <h1>Configurações pessoais</h1>

      <form className="cartao" onSubmit={salvar}>
        <h2>Meus dados</h2>
        <label htmlFor="n">Nome</label>
        <input id="n" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
        <label htmlFor="tel">Telefone / WhatsApp</label>
        <input id="tel" maxLength={30} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <label>E-mail</label>
        <input value={usuario.email} disabled />
        <p className="muted pequeno">Unidade: <strong>{usuario.unidadeNome || '—'}</strong> · Papel: <strong>{PAPEIS[usuario.papel]}</strong></p>

        <h2>Aparência</h2>
        <div className="duas-col">
          <div>
            <label htmlFor="tema">Tema</label>
            <select id="tema" value={tema} onChange={(e) => setTema(e.target.value)}>
              <option value="auto">Automático (do aparelho)</option>
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
            </select>
          </div>
          <div>
            <label htmlFor="fonte">Tamanho do texto</label>
            <select id="fonte" value={fonte} onChange={(e) => setFonte(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="grande">Grande</option>
            </select>
          </div>
        </div>
        {msg.texto && <div className={'aviso ' + (msg.tipo === 'ok' ? 'aviso-ok' : 'aviso-erro')} role="status">{msg.texto}</div>}
        <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </form>

      <section className="cartao">
        <h2>Minhas permissões</h2>
        <ul className="lista-simples">
          {Object.entries(PERMISSOES).map(([k, v]) => (
            <li key={k}>{usuario.permissoes.includes(k) ? '✅' : '⛔'} {v}</li>
          ))}
        </ul>
        <p className="muted pequeno">Para alterar permissões, fale com o responsável da sua unidade.</p>
      </section>

      <form className="cartao" onSubmit={trocarSenha}>
        <h2>Alterar senha</h2>
        <label htmlFor="sa">Senha atual</label>
        <input id="sa" type="password" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
        <label htmlFor="sn">Nova senha</label>
        <input id="sn" type="password" autoComplete="new-password" minLength={8} required value={nova} onChange={(e) => setNova(e.target.value)} />
        <label htmlFor="sn2">Repita a nova senha</label>
        <input id="sn2" type="password" autoComplete="new-password" minLength={8} required value={nova2} onChange={(e) => setNova2(e.target.value)} />
        {msgSenha.texto && <div className={'aviso ' + (msgSenha.tipo === 'ok' ? 'aviso-ok' : 'aviso-erro')} role="status">{msgSenha.texto}</div>}
        <button className="btn btn-primario">Alterar senha</button>
      </form>
    </>
  );
}
