import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { PAPEIS } from '../utils.js';
import icone from '../assets/icon.svg';

export default function Layout({ children }) {
  const { usuario, sair, can } = useAuth();

  const abas = [
    { to: '/', rotulo: 'Início', icone: '🏠' },
    { to: '/pautas', rotulo: 'Pautas', icone: '🗳️' },
    { to: '/graficos', rotulo: 'Gráficos', icone: '📊' },
    { to: '/calendario', rotulo: 'Calendário', icone: '📅' },
    { to: '/prestacoes', rotulo: 'Contas', icone: '📁' },
    ...(can('gerenciar_usuarios') ? [{ to: '/usuarios', rotulo: 'Usuários', icone: '👥' }] : []),
    { to: '/configuracoes', rotulo: 'Ajustes', icone: '⚙️' }
  ];

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-in">
          <div className="marca">
            <img className="marca-icone" src={icone} alt="" />
            <div>
              <strong>Decisões da Igreja</strong>
              <small>{usuario.unidadeNome || 'Sem unidade'}</small>
            </div>
          </div>
          <div className="topo-user">
            <span className="user-nome">{usuario.nome}</span>
            <span className="selo">{PAPEIS[usuario.papel]}</span>
            <button className="btn btn-sutil" onClick={() => sair()}>Sair</button>
          </div>
        </div>
        <nav className="abas" aria-label="Principal">
          {abas.map((a) => (
            <NavLink key={a.to} to={a.to} end={a.to === '/'} className={({ isActive }) => 'aba' + (isActive ? ' ativa' : '')}>
              <span className="aba-icone" aria-hidden>{a.icone}</span>
              <span>{a.rotulo}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  );
}
