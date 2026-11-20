import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import logo from '../assets/logo.svg';

function Recuperar({ emailInicial, onVoltar }) {
  const [etapa, setEtapa] = useState(1); // 1 = pedir código, 2 = informar código + nova senha, 3 = concluído
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const pedir = async (e) => {
    e.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      const r = await api('solicitarRecuperacao', { email });
      setMsg(r.mensagem);
      setEtapa(2);
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const redefinir = async (e) => {
    e.preventDefault();
    setErro('');
    if (senha !== senha2) return setErro('As senhas não conferem.');
    setOcupado(true);
    try {
      await api('redefinirComCodigo', { email, codigo, novaSenha: senha });
      setEtapa(3);
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  };

  if (etapa === 3) {
    return (
      <div className="cartao cartao-login">
        <img className="logo-img" src={logo} alt="Templo" />
        <h1>Senha alterada</h1>
        <div className="aviso aviso-ok" role="status">Pronto! Agora você já pode entrar com a nova senha.</div>
        <button className="btn btn-primario btn-bloco" onClick={onVoltar}>Ir para o login</button>
      </div>
    );
  }

  return (
    <form className="cartao cartao-login" onSubmit={etapa === 1 ? pedir : redefinir}>
      <img className="logo-img" src={logo} alt="Templo" />
      <h1>Esqueci minha senha</h1>

      {etapa === 1 ? (
        <>
          <p className="muted">Informe seu e-mail. Enviaremos um código para criar uma nova senha e avisaremos o responsável da sua unidade.</p>
          <label htmlFor="rec-email">E-mail</label>
          <input id="rec-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </>
      ) : (
        <>
          <div className="aviso aviso-info" role="status">{msg}</div>
          <label htmlFor="rec-cod">Código recebido por e-mail</label>
          <input id="rec-cod" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
          <label htmlFor="rec-s1">Nova senha</label>
          <input id="rec-s1" type="password" autoComplete="new-password" minLength={8} required value={senha} onChange={(e) => setSenha(e.target.value)} />
          <small className="muted">Mínimo de 8 caracteres, com letras e números.</small>
          <label htmlFor="rec-s2">Repita a nova senha</label>
          <input id="rec-s2" type="password" autoComplete="new-password" minLength={8} required value={senha2} onChange={(e) => setSenha2(e.target.value)} />
        </>
      )}

      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
      <button className="btn btn-primario btn-bloco" disabled={ocupado}>
        {ocupado ? 'Aguarde…' : etapa === 1 ? 'Enviar código' : 'Criar nova senha'}
      </button>
      <p className="centro pequeno"><button type="button" className="link" onClick={onVoltar}>Voltar ao login</button></p>
    </form>
  );
}

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (recuperando) {
    return <div className="tela-central"><Recuperar emailInicial={email} onVoltar={() => setRecuperando(false)} /></div>;
  }

  return (
    <div className="tela-central">
      <form className="cartao cartao-login" onSubmit={enviar}>
        <img className="logo-img" src={logo} alt="Templo" />
        <h1>Decisões da Igreja</h1>
        <p className="muted">Entre para votar, sugerir pautas e acompanhar os resultados.</p>

        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />

        {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}

        <button className="btn btn-primario btn-bloco" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p className="centro"><button type="button" className="link" onClick={() => setRecuperando(true)}>Esqueci minha senha</button></p>
        <p className="muted pequeno">Primeiro acesso? Use o e-mail e a senha temporária enviados pelo responsável da sua unidade.</p>
      </form>
    </div>
  );
}
