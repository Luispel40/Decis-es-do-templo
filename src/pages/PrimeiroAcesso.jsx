import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import logo from '../assets/logo.svg';

export default function PrimeiroAcesso() {
  const { usuario, setUsuario, sair } = useAuth();
  const [unidades, setUnidades] = useState([]);
  const [perguntas, setPerguntas] = useState([]);
  const [unidade, setUnidade] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([api('unidades'), api('perguntas')])
      .then(([u, q]) => {
        setUnidades(u);
        setPerguntas(q);
        if (usuario.unidadeId) setUnidade(u.find((x) => x.id === usuario.unidadeId) || null);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [usuario.unidadeId]);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!unidade) return setErro('Escolha sua unidade na lista de sugestões.');
    if (senha !== senha2) return setErro('As senhas não conferem.');
    setEnviando(true);
    try {
      const d = await api('completarCadastro', { unidadeNome: unidade.nome, respostas, novaSenha: senha });
      setUsuario(d.usuario);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="tela-central">
      <form className="cartao cartao-largo" onSubmit={enviar}>
        <img className="logo-img" src={logo} alt="Templo" />
        <h1>Bem-vindo(a), {usuario.nome.split(' ')[0]}!</h1>
        <p className="muted">Complete seu cadastro para começar. É rápido.</p>

        {carregando ? <p className="muted">Carregando…</p> : (
          <>
            <h2>1. Sua unidade</h2>
            <label htmlFor="unidade">Qual unidade você frequenta?</label>
            <Autocomplete id="unidade" itens={unidades} value={unidade} onChange={setUnidade} placeholder="Comece a digitar o nome…" />
            <small className="muted">Só é possível escolher unidades já cadastradas.</small>

            <h2>2. Sobre você</h2>
            {perguntas.map((q) => (
              <div key={q.id} className="campo">
                <label htmlFor={'q_' + q.id}>{q.texto}{q.obrigatoria && ' *'}</label>
                {q.tipo === 'select' ? (
                  <select id={'q_' + q.id} required={q.obrigatoria} value={respostas[q.id] || ''} onChange={(e) => setRespostas({ ...respostas, [q.id]: e.target.value })}>
                    <option value="">Selecione…</option>
                    {q.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={'q_' + q.id} type={q.tipo === 'data' ? 'date' : 'text'} maxLength={200} required={q.obrigatoria} value={respostas[q.id] || ''} onChange={(e) => setRespostas({ ...respostas, [q.id]: e.target.value })} />
                )}
              </div>
            ))}

            <h2>3. Crie sua senha</h2>
            <label htmlFor="s1">Nova senha</label>
            <input id="s1" type="password" autoComplete="new-password" minLength={8} required value={senha} onChange={(e) => setSenha(e.target.value)} />
            <small className="muted">Mínimo de 8 caracteres, com letras e números.</small>
            <label htmlFor="s2">Repita a nova senha</label>
            <input id="s2" type="password" autoComplete="new-password" minLength={8} required value={senha2} onChange={(e) => setSenha2(e.target.value)} />
          </>
        )}

        {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
        <div className="linha">
          <button className="btn btn-primario" disabled={enviando || carregando}>{enviando ? 'Salvando…' : 'Concluir cadastro'}</button>
          <button type="button" className="btn btn-sutil" onClick={() => sair()}>Sair</button>
        </div>
      </form>
    </div>
  );
}
